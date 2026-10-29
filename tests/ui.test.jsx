import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost'});
for(const name of ['window','document','navigator','HTMLElement','HTMLInputElement','HTMLTextAreaElement','Element','Node','SVGElement','MutationObserver','CustomEvent','Event','DocumentFragment'])Object.defineProperty(globalThis,name,{value:dom.window[name],configurable:true});
globalThis.self=dom.window;
globalThis.localStorage=dom.window.localStorage;
globalThis.sessionStorage=dom.window.sessionStorage;
globalThis.getComputedStyle=dom.window.getComputedStyle.bind(dom.window);
globalThis.requestAnimationFrame=fn=>setTimeout(fn,0);
globalThis.cancelAnimationFrame=clearTimeout;
globalThis.ResizeObserver=class{observe(){} unobserve(){} disconnect(){}};
dom.window.ResizeObserver=globalThis.ResizeObserver;
dom.window.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
dom.window.requestAnimationFrame=globalThis.requestAnimationFrame;
dom.window.cancelAnimationFrame=globalThis.cancelAnimationFrame;
HTMLElement.prototype.scrollIntoView=function(){};
const {render,screen,waitFor,cleanup,within}=await import('@testing-library/react');
const userEvent=(await import('@testing-library/user-event')).default;
const Provider=(await import('../components/provider.jsx')).default;
const Store=(await import('../components/store.jsx')).default;
const Checkout=(await import('../components/checkout.jsx')).default;
const BoxBuilder=(await import('../components/box-builder.jsx')).default;
const Boxes=(await import('../components/boxes.jsx')).default;
const ProductPage=(await import('../components/product-page.jsx')).default;
const CategoryPage=(await import('../components/category-page.jsx')).default;
const EnviosPage=(await import('../components/envios-page.jsx')).default;
const {enviosPageData}=await import('../lib/envios.js');
const {useCart}=await import('../components/use-cart.js');
const {makeOrder}=await import('../lib/checkout.js');
const WelcomePopup=(await import('../components/welcome-popup.jsx')).default;
const products=[
{id:'N001',nombre:'Almendras',categoria:'Frutos secos y semillas',precio:100,presentacion:'1 KG',imagen:'/images/product-001.webp',disponibilidad:'consultar'},
{id:'N002',nombre:'Chalita de harina de centeno y semilla de zapallo',categoria:'Galletitas y panificados',precio:200,presentacion:'1 KG',imagen:'/images/product-002.webp',disponibilidad:'consultar'},
{id:'N003',nombre:'Té verde',categoria:'Infusiones',precio:150,presentacion:'500 GR',imagen:'/images/product-003.webp',disponibilidad:'consultar'}
];
let orders=[],catalogReads=0,codeChecks=[],signups=[],serverProducts=products;
function setup(initialCatalog=null){
 cleanup();localStorage.clear();dom.reconfigure({url:'http://localhost'});orders=[];catalogReads=0;codeChecks=[];signups=[];serverProducts=products;
 globalThis.fetch=async(url,options)=>{if(url==='/api/catalog'){catalogReads++;return Response.json({products,settings:{name:'Vitalia',currency:'ARS',checkoutEnabled:true,testCheckout:true}});}const body=JSON.parse(options.body);
  if(url==='/api/cart/code'){codeChecks.push(body);return body.code==='BV-7K2Q-9MXD'?Response.json({ok:true,code:body.code,rate:10}):Response.json({error:'Este código ya se usó.',code:'CODE_USED'},{status:409});}
  if(url==='/api/welcome'){signups.push(body);return Response.json({ok:true,cartToken:'a'.repeat(64)});}
  assert.equal(url,'/api/checkout');orders.push(body);
  // El servidor de prueba arma el pedido con la misma lógica que el real.
  const {totals,items,...order}=makeOrder(body,serverProducts,{name:'Vitalia',currency:'ARS',phone:'5491100000000',testCheckout:true},{orderRef:'V-0001',code:body.code||null});
  return Response.json({...order,whatsappUrl:'http://localhost/#whatsapp-prueba',...(body.code?{codeToken:'b'.repeat(64)}:{})});};
 render(<Provider><Store initialCatalog={initialCatalog}/></Provider>);return userEvent.setup({document:dom.window.document});
}
test('React/Chakra: búsqueda, orden y categorías',async()=>{
 const user=setup();await screen.findByText('3 productos');
 const search=screen.getByRole('searchbox');await user.type(search,'te verde');assert.equal(document.querySelectorAll('.product-card').length,1);assert(screen.getByText('Té verde'));
 await user.clear(search);await user.selectOptions(screen.getByLabelText('Ordenar'),'price-desc');assert.equal(document.querySelector('.product-card').dataset.product,'N002');
 await user.click(screen.getByRole('button',{name:/^Frutos secos/}));assert.equal(document.querySelectorAll('.product-card').length,1);assert.equal(document.querySelector('.product-card').dataset.product,'N001');cleanup();
});
const catalog={products,settings:{name:'Vitalia',currency:'ARS',checkoutEnabled:true,testCheckout:true}};
function goCheckout(){cleanup();render(<Provider><Checkout initialCatalog={catalog}/></Provider>);}
test('Router: Mi pedido enlaza al checkout y cantidades persisten al volver',async()=>{
 const user=setup();await screen.findByText('3 productos');
 await user.click(screen.getByRole('button',{name:'Agregar Almendras',exact:true}));
 await user.click(screen.getByRole('button',{name:'Agregar Almendras',exact:true}));
 assert.equal(screen.getByRole('link',{name:/^Mi pedido/}).getAttribute('href'),'/checkout');
 assert.equal(document.querySelector('dialog.cart-dialog'),null);
 goCheckout();await screen.findByText('Productos elegidos');
 await user.click(screen.getByRole('button',{name:'Quitar una presentación de Almendras'}));
 assert.equal(JSON.parse(localStorage.getItem('vitalia-cart-v1')).N001,1);
 assert.equal(screen.getByRole('link',{name:'Catálogo',exact:true}).getAttribute('href'),'/');
 cleanup();render(<Provider><Store initialCatalog={catalog}/></Provider>);
 await screen.findByRole('link',{name:/^Mi pedido 1 productos/});cleanup();
});
test('Checkout: datos obligatorios, número de pedido del servidor y envío por WhatsApp',async()=>{
 const user=setup();await screen.findByText('3 productos');
 await user.click(screen.getByRole('button',{name:'Agregar Almendras',exact:true}));
 goCheckout();await screen.findByText('Productos elegidos');
 await user.click(screen.getByRole('button',{name:'Continuar por WhatsApp'}));assert.equal(orders.length,0);
 await user.type(screen.getByLabelText('Tu nombre'),'Ulises');await user.type(screen.getByLabelText('Localidad'),'Villa Allende');await user.type(screen.getByLabelText('Provincia'),'Córdoba');
 await user.click(screen.getByRole('button',{name:'Continuar por WhatsApp'}));
 await user.click(await screen.findByRole('link',{name:'Enviar por WhatsApp'}));await waitFor(()=>assert.equal(window.location.hash,'#whatsapp-prueba'));assert.equal(orders.length,1);assert.equal(orders[0].items[0].quantity,1);assert.equal(orders[0].province,'Córdoba');
 assert.equal(screen.queryByLabelText('Mensaje del pedido'),null);assert.equal(screen.queryByRole('button',{name:'Copiar mensaje'}),null);
 await user.type(screen.getByLabelText('Tu nombre'),' Astrada');assert.equal(screen.queryByRole('link',{name:'Abrir WhatsApp'}),null);cleanup();
});
test('React/Chakra: tema persistente y detalle de producto',async()=>{
 const user=setup();await screen.findByText('3 productos');await user.click(screen.getByRole('button',{name:'Activar modo oscuro'}));await waitFor(()=>assert.equal(document.documentElement.dataset.theme,'dark'));assert.equal(localStorage.getItem('vitalia-theme'),'dark');
 await user.click(screen.getByRole('button',{name:'Activar modo claro'}));await waitFor(()=>assert.equal(document.documentElement.dataset.theme,'light'));
 assert.equal(screen.getByRole('link',{name:'Almendras',exact:true}).getAttribute('href'),'/productos/almendras-n001');
 goCheckout();await screen.findByText('Tu pedido');
 await user.click(screen.getByRole('button',{name:'Activar modo oscuro'}));await waitFor(()=>assert.equal(document.documentElement.dataset.theme,'dark'));assert.equal(localStorage.getItem('vitalia-theme'),'dark');
 await user.click(screen.getByRole('button',{name:'Activar modo claro'}));await waitFor(()=>assert.equal(document.documentElement.dataset.theme,'light'));cleanup();
});


test('Checkout vacío y quitar último producto permiten volver al catálogo',async()=>{
 const user=setup();goCheckout();await screen.findByText('Tu pedido empieza con algo rico.');
 assert.equal(screen.getByRole('link',{name:'Explorar productos'}).getAttribute('href'),'/');
 assert.equal(screen.queryByRole('button',{name:'Continuar por WhatsApp'}),null);
 cleanup();localStorage.setItem('vitalia-cart-v1',JSON.stringify({N001:1}));
 render(<Provider><Checkout initialCatalog={catalog}/></Provider>);await screen.findByText('Productos elegidos');
 await user.click(screen.getByRole('button',{name:'Quitar Almendras',exact:true}));
 await screen.findByText('Tu pedido empieza con algo rico.');assert.equal(JSON.parse(localStorage.getItem('vitalia-cart-v1')).N001,undefined);cleanup();
});
test('Cross-sale aplica 10% al aceptar, persiste y recalcula al modificar el carrito',async()=>{
 const user=setup();await screen.findByText('3 productos');
 await user.click(screen.getByRole('button',{name:'Agregar Té verde',exact:true}));goCheckout();await screen.findByText('Productos elegidos');
 assert.equal(screen.queryByText('CASI LISTO'),null);
 const sidebar=document.querySelector('.checkout-sidebar');
 assert(sidebar.contains(screen.getByText('Resumen del pedido')));
 assert(sidebar.contains(screen.getByText('Descuentos para vos por tu compra')));
 assert.equal(document.querySelector('.checkout-main .cart-suggestions'),null);
 assert.equal(screen.queryByText('¿Sumamos otra presentación?'),null);
 assert.equal(screen.queryByRole('link',{name:/Seguir eligiendo/}),null);
 assert(within(sidebar).getByText('$ 200,00',{selector:'del'}));
 assert(within(sidebar).getByText('$ 180,00',{selector:'strong'}));
 assert.equal(JSON.parse(localStorage.getItem('vitalia-cart-v1')).N002,undefined);
 await user.click(screen.getByRole('button',{name:'Agregar sugerencia: Chalita de harina de centeno y semilla de zapallo'}));
 assert.equal(JSON.parse(localStorage.getItem('vitalia-cart-v1')).N002,1);
 assert.equal(screen.queryByRole('button',{name:/Agregar sugerencia: Chalita/}),null);
 assert(screen.getByText('$ 330,00',{selector:'.total-row strong'}));
 goCheckout();await screen.findByText('Productos elegidos');
 assert(screen.getByText('$ 330,00',{selector:'.total-row strong'}));
 cleanup();render(<Provider><Store initialCatalog={catalog}/></Provider>);
 await screen.findByText('$ 330,00',{selector:'.floating-cart-total'});
 goCheckout();await screen.findByText('Productos elegidos');
 await user.click(screen.getByRole('button',{name:'Sumar una presentación de Chalita de harina de centeno y semilla de zapallo'}));
 assert(screen.getByText('$ 530,00',{selector:'.total-row strong'}));
 await user.type(screen.getByLabelText('Tu nombre'),'Prueba');await user.type(screen.getByLabelText('Localidad'),'Córdoba');await user.type(screen.getByLabelText('Provincia'),'Córdoba');
 await user.click(screen.getByRole('button',{name:'Continuar por WhatsApp'}));await user.click(await screen.findByRole('link',{name:'Enviar por WhatsApp'}));await waitFor(()=>assert.equal(window.location.hash,'#whatsapp-prueba'));
 assert.equal(orders[0].items.find(i=>i.id==='N002').offerSourceId,'N003');
 await user.click(screen.getByRole('button',{name:'Quitar Té verde',exact:true}));
 assert(screen.getByText('$ 400,00',{selector:'.total-row strong'}));
 assert.equal(screen.queryByText('Ahorro por sugerencias (10%)'),null);
 assert.equal(screen.queryByRole('link',{name:'Abrir WhatsApp'}),null);cleanup();
});
test('Catálogo del servidor no se consulta otra vez al hidratar',async()=>{
 const user=setup(catalog);assert(screen.getByText('3 productos'));assert.equal(catalogReads,0);
 await user.type(screen.getByRole('searchbox'),'te verde');await user.click(screen.getByRole('button',{name:'Agregar Té verde',exact:true}));
 assert.equal(catalogReads,0);assert.equal(screen.getByRole('link',{name:/^Mi pedido/}).getAttribute('href'),'/checkout');cleanup();
});
test('Checkout refresca precios tras conflicto y exige preparar de nuevo',async()=>{
 const user=setup();await screen.findByText('3 productos');await user.click(screen.getByRole('button',{name:'Agregar Almendras',exact:true}));
 goCheckout();await screen.findByText('Productos elegidos');
 await user.type(screen.getByLabelText('Tu nombre'),'Ulises');await user.type(screen.getByLabelText('Localidad'),'Villa Allende');await user.type(screen.getByLabelText('Provincia'),'Córdoba');
 let freshReads=0;
 globalThis.fetch=async url=>{
  if(url==='/api/checkout')return Response.json({code:'CATALOG_CHANGED',error:'Cambió un precio. Revisá el total actualizado antes de continuar.'},{status:409});
  assert.equal(url,'/api/catalog?fresh=1');freshReads++;return Response.json({...catalog,products:products.map(p=>p.id==='N001'?{...p,precio:175}:p)});
 };
 await user.click(screen.getByRole('button',{name:'Continuar por WhatsApp'}));await screen.findByRole('alert');
 assert.equal(freshReads,1);assert(screen.getByText('$ 175,00',{selector:'.total-row strong'}));assert.equal(screen.queryByRole('link',{name:'Abrir WhatsApp'}),null);cleanup();
});

test('Asistente de boxes: ruta separada, preguntas y carrito compartido',async()=>{
 const user=setup(catalog);
 assert.equal(screen.getByRole('link',{name:'Boxes',exact:true}).getAttribute('href'),'/boxes');
 assert.equal(screen.queryByRole('button',{name:'No sé qué elegir',exact:true}),null);
 cleanup();render(<Provider><Boxes initialCatalog={catalog}/></Provider>);
 await user.click(screen.getByRole('button',{name:'No sé qué elegir',exact:true}));
 assert(screen.getByLabelText('¿Qué buscás con este box?'));
 await user.click(screen.getByLabelText('Para regalar'));
 assert(screen.getByLabelText('¿Para qué momento es el regalo?'));
 await user.selectOptions(screen.getByLabelText('¿Para qué momento es el regalo?'),'work');
 await user.type(screen.getByLabelText('¿Cuánto querés gastar como máximo?'),'300');
 await user.click(screen.getByRole('button',{name:'Ver mi selección'}));
 const result=screen.getByRole('region',{name:'Tu selección · Vitalia Work'});
 assert(within(result).getByText('$ 250,00',{selector:'.box-total strong'}));
 assert.deepEqual(JSON.parse(localStorage.getItem('vitalia-cart-v1')),{});
 await user.click(within(result).getByRole('button',{name:'Excluir del box: Almendras'}));
 assert(within(result).getByText('$ 150,00',{selector:'.box-total strong'}));
 await user.click(within(result).getByRole('button',{name:'Agregar selección al pedido'}));
 assert.deepEqual(JSON.parse(localStorage.getItem('vitalia-cart-v1')),{N003:1});
 assert(screen.getByRole('button',{name:'Agregado al pedido'}).disabled);
 goCheckout();await screen.findByText('Productos elegidos');assert(screen.getByText('$ 150,00',{selector:'.total-row strong'}));cleanup();
});

test('Boxes no superan los límites del carrito ni agregan parcialmente al fallar',async()=>{
 cleanup();localStorage.clear();localStorage.setItem('vitalia-cart-v1',JSON.stringify({N003:99}));
 function Harness(){const cart=useCart(products);return <BoxBuilder products={products} ready={cart.loaded} money={n=>String(n)} onAdd={cart.addSelection}/>;}
 render(<Provider><Harness/></Provider>);const user=userEvent.setup({document:dom.window.document});
 await user.click(screen.getByRole('button',{name:'Armar Vitalia Work'}));await user.click(screen.getByRole('button',{name:'Ver mi selección'}));
 await user.click(screen.getByRole('button',{name:'Agregar selección al pedido'}));
 assert(screen.getByText('Máximo de 99 presentaciones de Té verde.'));
 assert.deepEqual(JSON.parse(localStorage.getItem('vitalia-cart-v1')),{N003:99});cleanup();
});

test('Tarjetas: N296 (aceite de CBD) linkea a su página como el resto',async()=>{
 cleanup();localStorage.clear();const cbd={id:'N296',nombre:'Aceite de CBD al 40% — uso oral',categoria:'Suplementos',precio:9100,presentacion:'20 ml',imagen:'/images/product-001.webp',disponibilidad:'consultar',descripcion:''};
 render(<Provider><Store initialCatalog={{...catalog,products:[...products,cbd]}}/></Provider>);
 assert.equal(screen.getByRole('link',{name:'Aceite de CBD al 40% — uso oral',exact:true}).getAttribute('href'),'/productos/aceite-de-cbd-al-40-uso-oral-n296');
 assert.equal(screen.getByRole('link',{name:'Ver Aceite de CBD al 40% — uso oral',exact:true}).getAttribute('href'),'/productos/aceite-de-cbd-al-40-uso-oral-n296');cleanup();
});
test('Página de producto: agregar, stepper, foco en Ir a mi pedido y quitar',async()=>{
 cleanup();localStorage.clear();const product=products[0];
 render(<Provider><ProductPage catalog={catalog} product={product} page={{slug:'almendras-n001',pack:'1 KG',description:'',perKilo:null,whatsappUrl:'https://wa.me/5491100000000?text=x'}} related={[products[1]]} category={{href:'/categorias/frutos-secos-y-semillas',count:1}}/></Provider>);
 const user=userEvent.setup({document:dom.window.document});
 assert.equal(screen.getByRole('heading',{level:1}).textContent,'Almendras');
 assert.equal(screen.getByRole('link',{name:'Consultar por WhatsApp'}).getAttribute('href'),'https://wa.me/5491100000000?text=x');
 await user.click(screen.getByRole('button',{name:'Agregar al pedido'}));
 const go=await screen.findByRole('link',{name:'Ir a mi pedido'});assert.equal(go.getAttribute('href'),'/checkout');await waitFor(()=>assert.equal(document.activeElement,go));
 assert(screen.getByText('Sumaste 1 a tu pedido.'));
 await user.click(screen.getByRole('button',{name:'Sumar una presentación'}));assert(screen.getByText('Tenés 2 en tu pedido.'));assert.equal(JSON.parse(localStorage.getItem('vitalia-cart-v1')).N001,2);
 await user.click(screen.getByRole('button',{name:'Quitar una presentación'}));await user.click(screen.getByRole('button',{name:'Quitar una presentación'}));
 assert(screen.getByText('Quitaste el producto de tu pedido.'));assert(screen.getByRole('button',{name:'Agregar al pedido'}));
 assert.equal(screen.getByRole('link',{name:'Chalita de harina de centeno y semilla de zapallo'}).getAttribute('href'),'/productos/chalita-de-harina-de-centeno-y-semilla-de-zapallo-n002');cleanup();
});
test('Página de producto agotado: WhatsApp como acción principal',async()=>{
 cleanup();localStorage.clear();const product={...products[0],disponibilidad:'agotado'};
 render(<Provider><ProductPage catalog={{...catalog,products:[product,...products.slice(1)]}} product={product} page={{slug:'almendras-n001',pack:'1 KG',description:'',perKilo:null,whatsappUrl:'https://wa.me/5491100000000?text=x'}} related={[]} category={{href:'/categorias/frutos-secos-y-semillas',count:1}}/></Provider>);
 assert.equal(screen.queryByRole('button',{name:'Agregar al pedido'}),null);assert.equal(screen.getAllByRole('link',{name:'Consultar por WhatsApp'}).length,1);
 assert(screen.getByText('Está agotado por ahora. Escribinos y te contamos cuándo vuelve.'));cleanup();
});
test('Carrito flotante: nombre accesible = texto visible, dentro de un landmark',async()=>{
 cleanup();localStorage.clear();const {container}=render(<Provider><Store initialCatalog={catalog}/></Provider>);
 const link=container.querySelector('#floating-cart');assert.equal(link.getAttribute('aria-label'),null);
 assert.equal(link.closest('aside').getAttribute('aria-label'),'Tu pedido');
 assert(screen.getByRole('complementary',{name:'Tu pedido'}));
 assert.match(link.textContent,/^Mi pedido 0 productos Carrito vacío \$/);
 assert(screen.getByRole('link',{name:/^Mi pedido 0 productos Carrito vacío/}));cleanup();
});
test('Footer de producto y categoría igual al de la home: WhatsApp e Instagram',async()=>{
 cleanup();localStorage.clear();
 render(<Provider><ProductPage catalog={catalog} product={products[0]} page={{slug:'almendras-n001',pack:'1 KG',description:'',perKilo:null,whatsappUrl:''}} related={[]} category={{href:'/categorias/frutos-secos-y-semillas',count:1}} storeWhatsappUrl="https://wa.me/5491100000000"/></Provider>);
 assert.equal(screen.getByRole('link',{name:'Pedidos por WhatsApp'}).getAttribute('href'),'https://wa.me/5491100000000');
 assert.equal(screen.getByRole('link',{name:'Instagram @vitalia_energy'}).getAttribute('href'),'https://www.instagram.com/vitalia_energy/');
 cleanup();localStorage.clear();
 render(<Provider><CategoryPage catalog={catalog} category={{name:'Infusiones',slug:'infusiones',intro:''}} categories={[{name:'Infusiones',slug:'infusiones',count:1,href:'/categorias/infusiones'}]} storeWhatsappUrl="https://wa.me/5491100000000"/></Provider>);
 assert.equal(screen.getByRole('link',{name:'Pedidos por WhatsApp'}).getAttribute('href'),'https://wa.me/5491100000000');
 assert(screen.getByRole('link',{name:'Instagram @vitalia_energy'}));
 assert.equal(document.querySelector('.results-category').textContent,' · Infusiones');
 cleanup();
});
test('/envios: chips, secciones, tabla, retiro sin dirección, FAQ y footer con Instagram',async()=>{
 cleanup();localStorage.clear();
 const {container}=render(<Provider><EnviosPage catalog={catalog} page={enviosPageData('5491100000000')} storeWhatsappUrl="https://wa.me/5491100000000"/></Provider>);
 const user=userEvent.setup({document:dom.window.document});
 assert.equal(screen.getByRole('heading',{level:1}).textContent,'Envíos a Sierras Chicas y zona norte de Córdoba');
 const chips=[...container.querySelectorAll('a.zone-chip')];assert.equal(chips.length,9);
 for(const chip of chips)assert(container.querySelector(chip.getAttribute('href')),chip.getAttribute('href'));
 assert.equal(screen.getByRole('link',{name:'Envíos'}).getAttribute('aria-current'),'page');
 assert.equal(screen.getByRole('link',{name:'Pedir con envío a Mendiolaza'}).getAttribute('href'),'https://wa.me/5491100000000?text=Hola%2C%20quiero%20hacer%20un%20pedido%20con%20env%C3%ADo%20a%20Mendiolaza.');
 assert(screen.getByRole('heading',{name:'¿Qué dietética llega a Mendiolaza y El Talar?'}));
 const rows=[...container.querySelectorAll('.ship-table tbody tr')].map(tr=>tr.textContent);
 assert.deepEqual(rows,['Villa Allende, Mendiolaza, Saldán y Villa Rivera Indarte$3.000','Río Ceballos, Unquillo, La Calera, Argüello y Cerro de las Rosas$5.000','Compras de más de $70.000, todas las zonasGratis']);
 assert.equal(container.querySelector('.pickup-addr').textContent,'Retiro en Villa Allende, coordinamos la dirección por WhatsApp.');
 const triggers=container.querySelectorAll('.faq-trigger');assert.equal(triggers.length,13);assert.equal(triggers[8].textContent,'¿Hay pedido mínimo?');
 assert.equal(triggers[0].getAttribute('aria-expanded'),'true');assert.equal(triggers[1].getAttribute('aria-expanded'),'false');
 assert(container.querySelector('#faq-a1').hidden);
 await user.click(triggers[1]);assert.equal(triggers[1].getAttribute('aria-expanded'),'true');assert(!container.querySelector('#faq-a1').hidden);
 await user.click(triggers[0]);assert(container.querySelector('#faq-a0').hidden);
 assert(container.querySelector('#faq-a12').textContent.includes('al 11 0000-0000'));
 assert.equal(screen.getByRole('link',{name:'Instagram @vitalia_energy'}).getAttribute('href'),'https://www.instagram.com/vitalia_energy/');
 assert.equal(screen.getByRole('link',{name:'Pedidos por WhatsApp'}).getAttribute('href'),'https://wa.me/5491100000000');
 const html=container.innerHTML;assert(!html.includes('[A '));assert(!html.includes('1504'));assert(!html.includes('De la Unión'));
 cleanup();
});
test('Footer: Instagram y Envíos en catálogo, boxes y producto',async()=>{
 for(const element of [<Store initialCatalog={catalog}/>,<Boxes initialCatalog={catalog}/>,<ProductPage catalog={catalog} product={products[0]} page={{slug:'almendras-n001',pack:'1 KG',description:'',perKilo:null,whatsappUrl:''}} related={[]} category={{href:'/categorias/frutos-secos-y-semillas',count:1}}/>]){
  cleanup();localStorage.clear();render(<Provider>{element}</Provider>);
  assert.equal(screen.getByRole('link',{name:'Instagram @vitalia_energy'}).getAttribute('href'),'https://www.instagram.com/vitalia_energy/');
  assert.equal(screen.getByRole('link',{name:'Envíos'}).getAttribute('href'),'/envios');
 }
 cleanup();
});

const bigCatalog={products:[{...products[0],precio:100000},products[1],products[2]],settings:catalog.settings};
async function bigCheckout(quantity){
 setup();cleanup();serverProducts=bigCatalog.products;localStorage.setItem('vitalia-cart-v1',JSON.stringify({N001:quantity}));
 render(<Provider><Checkout initialCatalog={bigCatalog}/></Provider>);await screen.findByText('Productos elegidos');
 return userEvent.setup({document:dom.window.document});
}
test('Carrito ≥ $400.000: 10% automático con la etiqueta "desde", envío gratis y meta cumplida',async()=>{
 await bigCheckout(4);
 assert(screen.getByText('Descuento por compra desde $400.000 (10%)'));
 assert(screen.getByText('$ 360.000,00',{selector:'.total-row strong'}));
 assert.equal(document.querySelector('.sum-lines div:last-child dd').textContent,'Gratis');
 assert.match(document.querySelector('.goal').className,/done/);
 cleanup();
});
test('Carrito por debajo de $400.000: meta muestra lo que falta y no hay descuento',async()=>{
 await bigCheckout(3);
 assert.equal(screen.queryByText('Descuento por compra desde $400.000 (10%)'),null);
 assert.match(document.querySelector('.goal').textContent,/Te faltan \$\s100\.000,00 para el 10% off/);
 cleanup();
});
test('Código: se valida en el servidor, suma 10% plano (20% con el umbral) y viaja al checkout',async()=>{
 const user=await bigCheckout(4);
 await user.click(screen.getByRole('button',{name:'¿Tenés un código de descuento?'}));
 const input=screen.getByLabelText('Código de descuento');
 await user.type(input,'BV-2222-3333');await user.click(screen.getByRole('button',{name:'Aplicar'}));
 assert.equal((await screen.findByRole('alert')).textContent,'Este código ya se usó.');assert.equal(input.getAttribute('aria-invalid'),'true');
 await user.clear(input);await user.type(input,'bv 7k2q 9mxd');await user.click(screen.getByRole('button',{name:'Aplicar'}));
 await screen.findByText('Código aplicado: 10% sobre el subtotal de productos.');
 assert.equal(codeChecks.at(-1).code,'BV-7K2Q-9MXD');
 assert(screen.getByText('$ 320.000,00',{selector:'.total-row strong'}));assert(screen.getByText('Ahorrás $ 80.000,00'));
 await user.type(screen.getByLabelText('Tu nombre'),'Prueba');await user.type(screen.getByLabelText('Localidad'),'Córdoba');await user.type(screen.getByLabelText('Provincia'),'Córdoba');
 await user.click(screen.getByRole('button',{name:'Continuar por WhatsApp'}));
 await screen.findByRole('heading',{name:'Pedido listo para enviar'});
 assert.equal(orders[0].code,'BV-7K2Q-9MXD');assert.equal(orders[0].total,undefined);
 assert.equal(document.querySelector('.ref b').textContent,'#V-0001');
 assert.match(document.querySelector('.wa-preview').textContent,/Codigo de bienvenida BV-7K2Q-9MXD \(10%\): -\$40\.000,00/);
 assert.equal(JSON.parse(localStorage.getItem('vt_cart_code')).token,'b'.repeat(64));
 // Cambiar el carrito vuelve al resumen editable.
 await user.click(screen.getByRole('button',{name:'Sumar una presentación de Almendras'}));
 assert(await screen.findByRole('button',{name:'Continuar por WhatsApp'}));
 await user.click(screen.getByRole('button',{name:'Quitar el código BV-7K2Q-9MXD'}));
 assert(screen.getByText('$ 450.000,00',{selector:'.total-row strong'}));
 cleanup();
});
test('Popup: exit intent en compu, consentimiento obligatorio, código nunca en pantalla, no vuelve a aparecer',async()=>{
 setup();cleanup();
 const previous=dom.window.matchMedia;dom.window.matchMedia=()=>({matches:true,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
 try{
  render(<Provider><WelcomePopup/></Provider>);
  const user=userEvent.setup({document:dom.window.document});
  document.dispatchEvent(new dom.window.MouseEvent('mouseout',{clientY:0,bubbles:true}));
  const dialog=await screen.findByRole('dialog',{name:'10% off en tu primera compra'});
  assert.equal(dialog.getAttribute('aria-modal'),'true');
  assert.equal(screen.getByLabelText(/Acepto recibir novedades/).checked,false);
  await user.type(screen.getByLabelText('Nombre'),'Prueba');await user.type(screen.getByLabelText('Email'),'prueba@mail.com');
  await user.click(screen.getByRole('button',{name:'Quiero mi 10%'}));
  assert.equal(signups.length,0);assert(screen.getByText('Para mandarte el código necesitamos que aceptes recibir mails.'));
  await user.click(screen.getByLabelText(/Acepto recibir novedades/));await user.click(screen.getByRole('button',{name:'Quiero mi 10%'}));
  await screen.findByRole('heading',{name:'¡Listo, Prueba!'});
  assert.deepEqual(signups[0],{name:'Prueba',email:'prueba@mail.com',consent:true,website:''});
  assert.doesNotMatch(document.body.textContent,/BV-/);
  assert.equal(localStorage.getItem('vt_popup_subscribed'),'1');assert.equal(localStorage.getItem('vt_cart_token'),'a'.repeat(64));
  await user.click(screen.getByRole('button',{name:'Seguir comprando'}));
  assert.equal(screen.queryByRole('dialog'),null);
 }finally{dom.window.matchMedia=previous;cleanup();}
});
test('Popup: "No, gracias" lo cierra y queda oculto 30 días; no aparece por exit intent en celu',async()=>{
 setup();cleanup();sessionStorage.clear();
 render(<Provider><WelcomePopup/></Provider>);
 document.dispatchEvent(new dom.window.MouseEvent('mouseout',{clientY:0,bubbles:true}));
 await new Promise(r=>setTimeout(r,20));assert.equal(screen.queryByRole('dialog'),null);
 cleanup();
 const previous=dom.window.matchMedia;dom.window.matchMedia=()=>({matches:true,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
 try{
  render(<Provider><WelcomePopup/></Provider>);const user=userEvent.setup({document:dom.window.document});
  document.dispatchEvent(new dom.window.MouseEvent('mouseout',{clientY:0,bubbles:true}));
  await screen.findByRole('dialog');await user.click(screen.getByRole('button',{name:'No, gracias'}));
  assert.equal(screen.queryByRole('dialog'),null);assert.ok(Number(localStorage.getItem('vt_popup_dismissed_at'))>0);
  cleanup();sessionStorage.clear();render(<Provider><WelcomePopup/></Provider>);
  document.dispatchEvent(new dom.window.MouseEvent('mouseout',{clientY:0,bubbles:true}));
  await new Promise(r=>setTimeout(r,20));assert.equal(screen.queryByRole('dialog'),null);
 }finally{dom.window.matchMedia=previous;cleanup();}
});
