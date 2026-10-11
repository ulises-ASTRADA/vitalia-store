import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalizeRows,storeSettings} from '../lib/catalog.js';
import {makeOrder} from '../lib/checkout.js';
import {POST} from '../server/checkout.js';

const settings={name:'Vitalia',currency:'ARS',phone:'5493512136078',testCheckout:true};
const products=[{id:'A',nombre:'Cookies',precio:7800,presentacion:'500 gramos',disponibilidad:'consultar'},{id:'B',nombre:'Aceite',precio:15200,presentacion:'500 ml',disponibilidad:'disponible'}];
const valid=()=>({items:[{id:'A',quantity:2,expectedPrice:7800},{id:'B',quantity:1,expectedPrice:15200}],name:'Ulises',locality:'Villa Allende',province:'Córdoba',notes:'Consulta Córdoba'});

test('Pedido de prueba: total, cantidades, destino y texto UTF-8',()=>{
 const order=makeOrder(valid(),products,settings);
 assert.equal(order.total,30800);
 const url=new URL(order.whatsappUrl);
 assert.equal(url.hostname,'wa.me');assert.equal(url.pathname,'/5493512136078');
 assert.equal(url.searchParams.get('text'),order.message);
 assert.match(order.message,/PEDIDO DE PRUEBA/);assert.match(order.message,/2 × Cookies \(500 gramos\)/);assert.match(order.message,/Consulta Córdoba/);
});
test('No acepta precio manipulado, cambios de disponibilidad ni IDs ocultos',()=>{
 for(const edit of [b=>b.items[0].expectedPrice=1,b=>b.items[0].id='OCULTO']){
  const body=valid();edit(body);assert.throws(()=>makeOrder(body,products,settings),e=>e.status===409);
 }
 assert.throws(()=>makeOrder(valid(),[{...products[0],disponibilidad:'agotado'},products[1]],settings),e=>e.status===409);
});
test('Rechaza cantidades, líneas duplicadas y carrito vacío',()=>{
 for(const qty of [-1,0,1.5,100,'2']){const body=valid();body.items[0].quantity=qty;assert.throws(()=>makeOrder(body,products,settings),e=>e.status===400);}
 const body=valid();body.items.push(body.items[0]);assert.throws(()=>makeOrder(body,products,settings));
 assert.throws(()=>makeOrder({items:[],name:'Ulises',locality:'Villa Allende',province:'Córdoba',notes:''},products,settings));
});
test('Catálogo: precios numéricos, inactivos, IDs duplicados y vacíos',()=>{
 const headers=['id','nombre','precio','activo','disponibilidad'];
 assert.deepEqual(normalizeRows([headers,['A','Item',10,true,'consultar'],['B','Oculto',9,false,'']]).map(p=>p.id),['A']);
 for(const value of ['',0,-1,'7.800,00','foo']) assert.throws(()=>normalizeRows([headers,['A','Item',value,true,'']]));
 assert.throws(()=>normalizeRows([headers,['A','Item',1,true,''],['A','Item',2,true,'']]));
});
test('Catálogo: disponibilidad 0 significa agotado y bloquea el pedido',()=>{
 const headers=['id','nombre','precio','activo','disponibilidad'];
 for(const availability of [0,'0',' 0 ']){
  const [product]=normalizeRows([headers,['A','Cookies',7800,true,availability]]);
  assert.equal(product.disponibilidad,'agotado');
  assert.throws(()=>makeOrder(valid(),[product,products[1]],settings),e=>e.status===409);
 }
 assert.throws(()=>normalizeRows([headers,['A','Cookies',7800,true,'desconocido']]));
});
test('Pedidos largos conservan el mensaje completo en el enlace de WhatsApp',()=>{
 const rows=Array.from({length:50},(_,i)=>({...products[0],id:'P'+i,nombre:'Nombre largo de producto que necesita una presentación completa '+i}));
 const order=makeOrder({items:rows.map(p=>({id:p.id,quantity:1,expectedPrice:p.precio})),name:'Ulises',locality:'Villa Allende',province:'Córdoba',notes:''},rows,settings);
 assert.equal(new URL(order.whatsappUrl).searchParams.get('text'),order.message);assert.match(order.message,/P49/);
});
test('Extracción: 295 IDs, 295 fotos y precios idénticos a transcripción PDF',async()=>{
 const raw=JSON.parse(await readFile(new URL('../data/catalog.json',import.meta.url),'utf8'));
 const audit=JSON.parse(await readFile(new URL('../data/extraction-audit.json',import.meta.url),'utf8'));
 assert.equal(raw.length,295);assert.equal(new Set(raw.map(p=>p.id)).size,295);
 for(let i=0;i<raw.length;i++){assert.equal(raw[i].precio,Number(audit[i].precio_original.replace(/[^\d]/g,'')));assert.ok((await readFile(new URL('../public'+raw[i].imagen,import.meta.url))).length>0);}
});
test('Producción sin Sheets no habilita pedidos',()=>{
 const previous={...process.env};
 process.env.VERCEL_ENV='production';delete process.env.GOOGLE_SHEETS_ID;delete process.env.PREVIEW_MODE;delete process.env.ALLOW_TEST_CHECKOUT;process.env.WHATSAPP_NUMBER=settings.phone;
 assert.equal(storeSettings().isPreview,false);assert.equal(storeSettings().checkoutEnabled,false);
 for(const k of ['VERCEL_ENV','GOOGLE_SHEETS_ID','PREVIEW_MODE','ALLOW_TEST_CHECKOUT','WHATSAPP_NUMBER']){if(previous[k]===undefined)delete process.env[k];else process.env[k]=previous[k];}
});
test('API rechaza solicitudes de otro sitio y JSON incorrecto',async()=>{
 assert.equal((await POST(new Request('https://example.com/api/checkout',{method:'POST',headers:{origin:'https://other.com','content-type':'application/json'},body:'{}'}))).status,403);
 assert.equal((await POST(new Request('https://example.com/api/checkout',{method:'POST',headers:{'content-type':'application/json'},body:'wrong'}))).status,400);
});

test('Nombre, localidad y provincia son obligatorios y aparecen en el mensaje',()=>{
 for(const key of ['name','locality','province']){
  for(const invalid of [undefined,'','   ','\n\t',123,'x'.repeat(101)]){
   const body=valid();body[key]=invalid;
   assert.throws(()=>makeOrder(body,products,settings),e=>e.status===400);
  }
 }
 const body=valid();body.name='  Ulises  ';
 const order=makeOrder(body,products,settings);
 assert.match(order.message,/Nombre: Ulises/);
 assert.match(order.message,/Localidad: Villa Allende/);
 assert.match(order.message,/Provincia: Córdoba/);
});

 test('Mensaje claro: sin presentación faltante, total compacto y dos emojis',()=>{
 const p={id:'N001',nombre:'Pepas',precio:16500,presentacion:'',disponibilidad:'consultar'};
 const order=makeOrder({items:[{id:p.id,quantity:1,expectedPrice:p.precio}],name:'Ulises',locality:'Villa Allende',province:'Córdoba',notes:''},[p],settings);
 assert.ok(order.message.includes('☘️ ¡Hola, Vitalia!'));
 assert.ok(order.message.includes('✅ Total: $16.500,00'));
 const decoded=new URL(order.whatsappUrl).searchParams.get('text');
 assert.equal(decoded,order.message);
 assert.ok(!/[\uFFFD\u{10000}-\u{10FFFF}]/u.test(decoded));
 assert.ok(order.message.endsWith('A confirmar: disponibilidad, envío y forma de pago.'));
 assert.ok(!order.message.includes('presentación a confirmar'));
 assert.ok(!order.message.includes('Total de productos:'));
 assert.ok(!order.message.includes(' ARS'));
});
