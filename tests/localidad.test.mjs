import test from 'node:test';
import assert from 'node:assert/strict';
import {SHIPPING_COST,FREE_SHIPPING_FROM,OTHER_ZONE,ZONE_SUB_AREAS,checkoutZoneGroups,shippingQuote,zoneOptionLabel,enviosPageData} from '../lib/envios.js';
import {computeTotals} from '../lib/promos.js';
import {makeOrder} from '../lib/checkout.js';
import {handleCheckout} from '../server/checkout.js';
import {growthStore} from '../server/growth-store.js';
import {appendOrder} from '../lib/orders.js';

const settings={name:'Vitalia',currency:'ARS',phone:'5493512136078',testCheckout:true};
const products=[{id:'A',nombre:'Granola',precio:10000,presentacion:'1 KG',disponibilidad:'disponible'}];
const body=(extra,quantity=1)=>({items:[{id:'A',quantity,expectedPrice:10000}],name:'Ana',province:'Córdoba',notes:'',zone:'',locality:'',...extra});
const ZONES={
  'villa-allende':['Villa Allende (incluye Golf, Lomas y Parque)',3000,'Villa Allende'],
  mendiolaza:['Mendiolaza (incluye El Talar)',3000,'Mendiolaza'],
  saldan:['Saldán',3000,'Saldán'],
  'villa-rivera-indarte':['Villa Rivera Indarte',3000,'Villa Rivera Indarte'],
  'rio-ceballos':['Río Ceballos',5000,'Río Ceballos'],
  unquillo:['Unquillo',5000,'Unquillo'],
  'la-calera':['La Calera (incluye countries)',5000,'La Calera'],
  arguello:['Argüello',5000,'Argüello'],
  'cerro-de-las-rosas':['Cerro de las Rosas',5000,'Cerro de las Rosas']};

test('Localidad: el desplegable sale de la misma tabla que /envios, en el orden pedido y agrupado por costo',()=>{
  const groups=checkoutZoneGroups();
  assert.deepEqual(groups.map(g=>g.label),['Envío $3.000','Envío $5.000']);
  assert.deepEqual(groups.flatMap(g=>g.options.map(o=>[o.value,o.label])),Object.entries(ZONES).map(([slug,[label]])=>[slug,label]));
  assert.deepEqual(new Set(groups.flatMap(g=>g.options.map(o=>o.value))),new Set(Object.keys(SHIPPING_COST)));
  for(const g of groups)for(const o of g.options)assert.equal(SHIPPING_COST[o.value],g.cost);
  // Las sub-zonas del desplegable son las mismas que nombra /envios (tabla de costos y secciones).
  const page=enviosPageData('5491100000000'),table=page.table.map(r=>r.label).join(' ');
  for(const [slug,subs] of Object.entries(ZONE_SUB_AREAS))for(const sub of subs){
    assert.ok(zoneOptionLabel(slug).includes(sub.short),sub.short);
    assert.ok(table.includes(sub.name),sub.name);
  }
  for(const name of ['Villa Allende Golf','Lomas','Villa Allende Parque','El Talar','countries'])assert.ok(table.includes(name),name);
});

test('Localidad: costo por zona, "Otra localidad", envío gratis y sin elegir',()=>{
  for(const [slug,[,cost]] of Object.entries(ZONES)){
    assert.deepEqual(shippingQuote(slug,false),{kind:'zone',cents:cost*100,label:cost===3000?'$3.000':'$5.000'});
    assert.deepEqual(shippingQuote(slug,true),{kind:'free',cents:0,label:'Gratis'});
  }
  assert.deepEqual(shippingQuote('',false),{kind:'pending',cents:0,label:'Elegí tu localidad'});
  assert.deepEqual(shippingQuote(undefined,true),{kind:'pending',cents:0,label:'Elegí tu localidad'});
  assert.deepEqual(shippingQuote(OTHER_ZONE,false),{kind:'other',cents:0,label:'A coordinar por WhatsApp'});
  assert.deepEqual(shippingQuote(OTHER_ZONE,true),{kind:'other',cents:0,label:'A coordinar por WhatsApp'});
  for(const bad of ['cordoba','__proto__','constructor','toString','Villa Allende',3000,{}])assert.equal(shippingQuote(bad,false),null);
  // El total suma el envío; el umbral es el mismo de siempre (subtotal bruto ≥ $70.000).
  const t=computeTotals({grossCents:1000000,zone:'unquillo'});
  assert.equal(t.totalCents,1000000);assert.equal(t.shippingCents,500000);assert.equal(t.payCents,1500000);
  const below=computeTotals({grossCents:FREE_SHIPPING_FROM*100-1,zone:'saldan'});
  assert.equal(below.freeShipping,false);assert.equal(below.payCents,FREE_SHIPPING_FROM*100-1+300000);
  const at=computeTotals({grossCents:FREE_SHIPPING_FROM*100,zone:'saldan'});
  assert.equal(at.freeShipping,true);assert.equal(at.shipping.label,'Gratis');assert.equal(at.payCents,FREE_SHIPPING_FROM*100);
  assert.equal(computeTotals({grossCents:1000000,zone:OTHER_ZONE}).payCents,1000000);
  assert.throws(()=>computeTotals({grossCents:1000000,zone:'marte'}));
});

test('Servidor: cada zona recalcula el envío y lo suma al total; el mensaje lleva localidad y costo',()=>{
  for(const [slug,[,cost,name]] of Object.entries(ZONES)){
    const order=makeOrder(body({zone:slug,locality:'Otra cosa'}),products,settings);
    assert.equal(order.locality,name);assert.equal(order.shippingCost,cost);
    assert.equal(order.productsTotal,10000);assert.equal(order.total,10000+cost);
    const pesos=cost===3000?'3.000':'5.000',sum=cost===3000?'13.000':'15.000';
    assert.match(order.message,new RegExp(`\\nEnvio: \\$${pesos.replace('.','\\.')},00\\nTotal: \\$${sum.replace('.','\\.')},00\\n`));
    assert.match(order.message,new RegExp(`\\nLocalidad: ${name}\\n`));
    assert.ok(!order.message.includes('Otra cosa'),'la localidad del cliente no reemplaza a la zona');
  }
  const free=makeOrder(body({zone:'la-calera'},7),products,settings);
  assert.equal(free.freeShipping,true);assert.equal(free.shippingCost,0);assert.equal(free.total,70000);
  assert.match(free.message,/\nEnvio: Gratis\nTotal: \$70\.000,00\n/);
});

test('Servidor: nunca toma un monto del cliente y rechaza slugs desconocidos o sin localidad',()=>{
  const order=makeOrder(body({zone:'saldan',shippingCost:0,shippingCents:0,shipping:{cents:0},total:1,freeShipping:true}),products,settings);
  assert.equal(order.shippingCost,3000);assert.equal(order.total,13000);assert.equal(order.freeShipping,false);
  for(const zone of [undefined,'','marte','__proto__','hasOwnProperty','Villa Allende','SALDAN',3000,null,['saldan'],{slug:'saldan'}])
    assert.throws(()=>makeOrder(body({zone}),products,settings),e=>e.status===400&&e.message==='Elegí tu localidad.',String(zone));
});

test('Otra localidad: texto obligatorio, limpio, hasta 60 caracteres; envío "a coordinar" y fuera del total',()=>{
  const order=makeOrder(body({zone:OTHER_ZONE,locality:'  Jesús\u0000María\n\t  centro  '}),products,settings);
  assert.equal(order.locality,'Jesús María centro (otra localidad)');
  assert.equal(order.shippingCost,null);assert.equal(order.total,10000);assert.equal(order.shipping.label,'A coordinar por WhatsApp');
  assert.match(order.message,/\nEnvio: A coordinar por WhatsApp\nTotal \(sin envio\): \$10\.000,00\n/);
  assert.match(order.message,/\nLocalidad: Jesús María centro \(otra localidad\)\n/);
  assert.ok(order.message.endsWith('A confirmar: disponibilidad, envío y forma de pago.'));
  // Aun superando el envío gratis, fuera de las zonas el envío se coordina.
  const big=makeOrder(body({zone:OTHER_ZONE,locality:'Jesús María'},8),products,settings);
  assert.equal(big.shippingCost,null);assert.match(big.message,/\nEnvio: A coordinar por WhatsApp\n/);
  assert.equal(makeOrder(body({zone:OTHER_ZONE,locality:'x'.repeat(60)}),products,settings).locality,`${'x'.repeat(60)} (otra localidad)`);
  for(const locality of [undefined,'','   ','\n\t\u0000',123,'x'.repeat(61),'x'.repeat(500)])
    assert.throws(()=>makeOrder(body({zone:OTHER_ZONE,locality}),products,settings),e=>e.status===400,String(locality).slice(0,10));
});

test('Planilla: la localidad y el envío salen del servidor; el texto libre pasa por el escape anti-fórmulas',async()=>{
  const env={VERCEL:'1',VERCEL_ENV:'preview',ALLOW_TEST_CHECKOUT:'true',WHATSAPP_NUMBER:'5491100000000'};
  const previous=Object.fromEntries(Object.keys(env).map(k=>[k,process.env[k]]));Object.assign(process.env,env);
  const post=payload=>new Request('https://www.vitalia.energy/api/checkout',{method:'POST',headers:{origin:'https://www.vitalia.energy','content-type':'application/json','x-vercel-forwarded-for':`198.51.100.${Math.floor(Math.random()*200)+1}`},body:JSON.stringify(payload)});
  try{
    delete globalThis.__vitaliaGrowthMemory;
    const store=growthStore({}),rows=[];
    const recordOrder=async row=>{rows.push(row);return 'VIT-TEST';};
    const loadCatalog=async()=>({products});
    let res=await handleCheckout(post(body({zone:'rio-ceballos',locality:'=HACK()',shippingCost:0,total:1})),{store,loadCatalog,recordOrder});
    assert.equal(res.status,200);
    const json=await res.json();
    assert.equal(json.total,15000);
    assert.equal(rows[0].locality,'Río Ceballos');assert.equal(rows[0].shippingCost,5000);assert.equal(rows[0].total,10000);
    res=await handleCheckout(post(body({zone:OTHER_ZONE,locality:'=HYPERLINK("x")'})),{store,loadCatalog,recordOrder});
    assert.equal(res.status,200);
    assert.equal(rows[1].locality,'=HYPERLINK("x") (otra localidad)');assert.equal(rows[1].shippingCost,null);
    res=await handleCheckout(post(body({zone:'marte'})),{store,loadCatalog,recordOrder});
    assert.equal(res.status,400);assert.equal(rows.length,2);
    // La fila que llega a la planilla: escape anti-fórmulas, costo "A coordinar".
    const originalFetch=globalThis.fetch;let captured;
    globalThis.fetch=async(url,options)=>{captured=JSON.parse(options.body);return Response.json({status:'ok'});};
    process.env.ORDERS_WEBHOOK_URL='https://script.google.com/macros/s/test/exec';
    try{
      await appendOrder(rows[1]);
      assert.equal(captured.locality,`'=HYPERLINK("x") (otra localidad)`);
      assert.equal(captured.costo_envio,'A coordinar');
      await appendOrder(rows[0]);
      assert.equal(captured.locality,'Río Ceballos');assert.equal(captured.costo_envio,5000);
    }finally{globalThis.fetch=originalFetch;delete process.env.ORDERS_WEBHOOK_URL;}
  }finally{for(const [k,v] of Object.entries(previous)){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
});
