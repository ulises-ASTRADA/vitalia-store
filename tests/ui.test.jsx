import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost'});
for(const name of ['window','document','navigator','HTMLElement','HTMLInputElement','HTMLTextAreaElement','Element','Node','SVGElement','MutationObserver','CustomEvent','Event','DocumentFragment'])Object.defineProperty(globalThis,name,{value:dom.window[name],configurable:true});
globalThis.self=dom.window;
globalThis.localStorage=dom.window.localStorage;
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
const {useCart}=await import('../components/use-cart.js');
const products=[
{id:'N001',nombre:'Almendras',categoria:'Frutos secos y semillas',precio:100,presentacion:'1 KG',imagen:'/images/product-001.webp',disponibilidad:'consultar'},
{id:'N002',nombre:'Chalita de harina de centeno y semilla de zapallo',categoria:'Galletitas y panificados',precio:200,presentacion:'1 KG',imagen:'/images/product-002.webp',disponibilidad:'consultar'},
{id:'N003',nombre:'Té verde',categoria:'Infusiones',precio:150,presentacion:'500 GR',imagen:'/images/product-003.webp',disponibilidad:'consultar'}
];
let orders=[],catalogReads=0;
function setup(initialCatalog=null){
 cleanup();localStorage.clear();dom.reconfigure({url:'http://localhost'});orders=[];catalogReads=0;
 globalThis.fetch=async(url,options)=>{if(url==='/api/catalog'){catalogReads++;return Response.json({products,settings:{name:'Vitalia',currency:'ARS',checkoutEnabled:true,testCheckout:true}});}assert.equal(url,'/api/checkout');const body=JSON.parse(options.body);orders.push(body);return Response.json({message:'PEDIDO DE PRUEBA — NO CONFIRMAR\nTotal: $200,00',total:200,whatsappUrl:'http://localhost/#whatsapp-prueba'});};
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
 assert.equal(screen.getByRole('link',{name:/Ir a mi pedido/}).getAttribute('href'),'/checkout');
 assert.equal(document.querySelector('dialog.cart-dialog'),null);
 goCheckout();await screen.findByText('Productos elegidos');
 await user.click(screen.getByRole('button',{name:'Quitar una presentación de Almendras'}));
 assert.equal(JSON.parse(localStorage.getItem('vitalia-cart-v1')).N001,1);
 assert.equal(screen.getByRole('link',{name:'Catálogo',exact:true}).getAttribute('href'),'/');
 cleanup();render(<Provider><Store initialCatalog={catalog}/></Provider>);
 await screen.findByRole('link',{name:/Ir a mi pedido, 1 presentaciones/});cleanup();
});
test('Checkout: datos obligatorios y redirección directa sin vista previa',async()=>{
 const user=setup();await screen.findByText('3 productos');
 await user.click(screen.getByRole('button',{name:'Agregar Almendras',exact:true}));
 goCheckout();await screen.findByText('Productos elegidos');
 await user.click(screen.getByRole('button',{name:'Continuar por WhatsApp'}));assert.equal(orders.length,0);
 await user.type(screen.getByLabelText('Tu nombre'),'Ulises');await user.type(screen.getByLabelText('Localidad'),'Villa Allende');await user.type(screen.getByLabelText('Provincia'),'Córdoba');
 await user.click(screen.getByRole('button',{name:'Continuar por WhatsApp'}));
 await waitFor(()=>assert.equal(window.location.hash,'#whatsapp-prueba'));assert.equal(orders.length,1);assert.equal(orders[0].items[0].quantity,1);assert.equal(orders[0].province,'Córdoba');
 assert.equal(screen.queryByLabelText('Mensaje del pedido'),null);assert.equal(screen.queryByRole('button',{name:'Copiar mensaje'}),null);
 await user.type(screen.getByLabelText('Tu nombre'),' Astrada');assert.equal(screen.queryByRole('link',{name:'Abrir WhatsApp'}),null);cleanup();
});
test('React/Chakra: tema persistente y detalle de producto',async()=>{
 const user=setup();await screen.findByText('3 productos');await user.click(screen.getByRole('button',{name:'Activar modo oscuro'}));await waitFor(()=>assert.equal(document.documentElement.dataset.theme,'dark'));assert.equal(localStorage.getItem('vitalia-theme'),'dark');
 await user.click(screen.getByRole('button',{name:'Activar modo claro'}));await waitFor(()=>assert.equal(document.documentElement.dataset.theme,'light'));
 await user.click(screen.getByRole('button',{name:'Ver Almendras',exact:true}));const detail=await screen.findByRole('dialog',{name:'Almendras'});assert(within(detail).getByText('Disponibilidad a confirmar por WhatsApp'));await user.click(within(detail).getByRole('button',{name:'Cerrar',exact:true}));
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
 await user.click(screen.getByRole('button',{name:'Continuar por WhatsApp'}));await waitFor(()=>assert.equal(window.location.hash,'#whatsapp-prueba'));
 assert.equal(orders[0].items.find(i=>i.id==='N002').offerSourceId,'N003');
 await user.click(screen.getByRole('button',{name:'Quitar Té verde',exact:true}));
 assert(screen.getByText('$ 400,00',{selector:'.total-row strong'}));
 assert.equal(screen.queryByText('Ahorro por sugerencias (10%)'),null);
 assert.equal(screen.queryByRole('link',{name:'Abrir WhatsApp'}),null);cleanup();
});
test('Catálogo del servidor no se consulta otra vez al hidratar',async()=>{
 const user=setup(catalog);assert(screen.getByText('3 productos'));assert.equal(catalogReads,0);
 await user.type(screen.getByRole('searchbox'),'te verde');await user.click(screen.getByRole('button',{name:'Agregar Té verde',exact:true}));
 assert.equal(catalogReads,0);assert.equal(screen.getByRole('link',{name:/Ir a mi pedido/}).getAttribute('href'),'/checkout');cleanup();
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
