import test from 'node:test';
import assert from 'node:assert/strict';
import {growthStore,growthMode,isRealSecret} from '../server/growth-store.js';
import {welcomePOST,codePOST,cartSavePOST,unsubscribePOST} from '../server/growth.js';
import {handleCheckout} from '../server/checkout.js';
import {normalizeCode} from '../lib/code-format.js';
import {generateCode,normalizeEmail} from '../lib/welcome-code.js';

const SITE='https://www.vitalia.energy';
let ipSeq=1;
const nextIp=()=>`203.0.113.${ipSeq++}`;
function post(path,body,{ip=nextIp(),origin=SITE}={}) {
  return new Request(SITE+path,{method:'POST',headers:{origin,'content-type':'application/json','x-vercel-forwarded-for':ip},body:JSON.stringify(body)});
}
function withEnv(values,fn) {
  return async()=>{
    const previous=Object.fromEntries(Object.keys(values).map(k=>[k,process.env[k]]));
    Object.assign(process.env,values);
    try{await fn();}finally{for(const [k,v] of Object.entries(previous)){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
  };
}
const freshStore=()=>{delete globalThis.__vitaliaGrowthMemory;return growthStore({});};
const mailbox=()=>{const sent=[];const send=async mail=>{sent.push(mail);return true;};return {sent,send};};
const signup=(email,extra={})=>({name:'Prueba',email,consent:true,website:'',...extra});
const products=[{id:'A',nombre:'Granola',precio:100000,presentacion:'1 KG',disponibilidad:'disponible'}];
const loadCatalog=async()=>({products});
const checkoutBody=extra=>({items:[{id:'A',quantity:4,expectedPrice:100000}],name:'Prueba',locality:'Córdoba',province:'Córdoba',notes:'',...extra});
const checkoutEnv={VERCEL:'1',VERCEL_ENV:'preview',ALLOW_TEST_CHECKOUT:'true',WHATSAPP_NUMBER:'5491100000000'};

test('Claves dummy o vacías nunca activan Supabase; en Vercel sin claves falla cerrado',()=>{
  assert.equal(isRealSecret('dummy'),false);assert.equal(isRealSecret(''),false);assert.equal(isRealSecret(undefined),false);
  assert.equal(growthMode({SUPABASE_URL:'https://x.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'dummy'}),'memory');
  assert.equal(growthMode({SUPABASE_URL:'https://x.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'dummy',VERCEL:'1'}),'unavailable');
});
test('Formato del código: alfabeto sin ambigüedades y normalización',()=>{
  for(let i=0;i<50;i++)assert.match(generateCode(),/^BV-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  assert.equal(normalizeCode(' bv 7k2q 9mxd '),'BV-7K2Q-9MXD');assert.equal(normalizeCode('7K2Q9MXD'),'BV-7K2Q-9MXD');
  assert.equal(normalizeCode('BV-0000-1111'),null);assert.equal(normalizeCode('<script>'),null);
});
test('Validación de mail en el servidor',()=>{
  assert.equal(normalizeEmail(' Hola@Mail.COM '),'hola@mail.com');
  for(const bad of ['','sin-arroba','a@b','a@@b.com','a b@c.com','a..b@c.com','x'.repeat(250)+'@a.com',123,null])assert.equal(normalizeEmail(bad),null,String(bad));
});
test('Alta: el código va solo por mail, nunca en la respuesta; sin consentimiento no hay alta',withEnv({VERCEL:'1'},async()=>{
  const store=freshStore(),{sent,send}=mailbox();
  let response=await welcomePOST(post('/api/welcome',signup('a@mail.com',{consent:false})),{store,send});
  assert.equal(response.status,400);assert.equal((await response.json()).code,'CONSENT_REQUIRED');
  response=await welcomePOST(post('/api/welcome',signup('no-es-mail')),{store,send});
  assert.equal(response.status,400);assert.equal((await response.json()).field,'email');
  response=await welcomePOST(post('/api/welcome',signup('a@mail.com')),{store,send});
  const text=await response.text();
  assert.equal(response.status,200);assert.equal(sent.length,1);
  assert.match(sent[0].code,/^BV-/);assert.ok(!text.includes(sent[0].code),'el código no vuelve al navegador');
  assert.match(JSON.parse(text).cartToken,/^[0-9a-f]{64}$/);
  // Solo se guardan hashes: ni el código ni los tokens quedan en claro.
  assert.ok(!JSON.stringify([...store._db.codes,...store._db.subscribers]).includes(sent[0].code));
  response=await welcomePOST(post('/api/welcome',signup('A@Mail.com')),{store,send});
  assert.equal(response.status,409);assert.equal(sent.length,1);
  assert.equal((await welcomePOST(post('/api/welcome',signup('b@mail.com'),{origin:'https://evil.example'}),{store,send})).status,403);
}));
test('Honeypot: responde como si fuera real, pero no guarda ni manda nada',withEnv({VERCEL:'1'},async()=>{
  const store=freshStore(),{sent,send}=mailbox();
  const response=await welcomePOST(post('/api/welcome',signup('bot@mail.com',{website:'https://spam.example'})),{store,send});
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{ok:true});
  assert.equal(sent.length,0);assert.equal(store._db.subscribers.length,0);
}));
test('Rate limit por IP en el alta: 5 cada 10 minutos, otra IP no se ve afectada',withEnv({VERCEL:'1'},async()=>{
  const store=freshStore(),{send}=mailbox(),ip='198.51.100.7';
  for(let i=0;i<5;i++)assert.notEqual((await welcomePOST(post('/api/welcome',signup(`rl${i}@mail.com`),{ip}),{store,send})).status,429);
  const blocked=await welcomePOST(post('/api/welcome',signup('rl9@mail.com'),{ip}),{store,send});
  assert.equal(blocked.status,429);assert.equal((await blocked.json()).code,'RATE_LIMITED');
  assert.equal((await welcomePOST(post('/api/welcome',signup('rl9@mail.com'),{ip:'198.51.100.8'}),{store,send})).status,200);
  // Pasada la ventana, vuelve a aceptar.
  assert.equal((await welcomePOST(post('/api/welcome',signup('rl10@mail.com'),{ip}),{store,send,now:Date.now()+11*60000})).status,200);
}));
test('Si el mail no sale, no queda alta (se puede reintentar)',withEnv({VERCEL:'1'},async()=>{
  const store=freshStore();
  const response=await welcomePOST(post('/api/welcome',signup('falla@mail.com')),{store,send:async()=>false});
  assert.equal(response.status,503);assert.equal(store._db.subscribers.length,0);
}));
test('Código de un solo uso: el segundo pedido con el mismo código se rechaza',withEnv(checkoutEnv,async()=>{
  const store=freshStore(),{sent,send}=mailbox();
  await welcomePOST(post('/api/welcome',signup('uso@mail.com')),{store,send});
  const code=sent[0].code;
  let response=await codePOST(post('/api/cart/code',{code:code.toLowerCase()}),{store});
  assert.equal(response.status,200);assert.equal((await response.json()).code,code);
  assert.equal((await codePOST(post('/api/cart/code',{code:'BV-2222-3333'}),{store})).status,404);
  assert.equal((await codePOST(post('/api/cart/code',{code:'cualquier cosa'}),{store})).status,400);
  response=await handleCheckout(post('/api/checkout',checkoutBody({code})),{store,loadCatalog});
  const first=await response.json();
  assert.equal(response.status,200,JSON.stringify(first));
  assert.equal(first.subtotal,400000);assert.equal(first.total,320000);assert.equal(first.freeShipping,true);
  assert.match(first.orderRef,/^V-\d{4}$/);assert.match(first.message,new RegExp(`Pedido #${first.orderRef}`));assert.match(first.message,new RegExp(code));
  assert.match(first.codeToken,/^[0-9a-f]{64}$/);
  // El mismo carrito (mismo token) puede volver a preparar el pedido; otro no.
  assert.equal((await handleCheckout(post('/api/checkout',checkoutBody({code,codeToken:first.codeToken})),{store,loadCatalog})).status,200);
  response=await handleCheckout(post('/api/checkout',checkoutBody({code})),{store,loadCatalog});
  assert.equal(response.status,409);assert.equal((await response.json()).code,'CODE_USED');
  response=await codePOST(post('/api/cart/code',{code}),{store});
  assert.equal(response.status,409);assert.equal((await response.json()).error,'Este código ya se usó.');
  // Dos pedidos simultáneos con un código nuevo: solo uno lo reserva.
  await welcomePOST(post('/api/welcome',signup('doble@mail.com')),{store,send});
  const other=sent[1].code;
  const statuses=(await Promise.all([1,2].map(()=>handleCheckout(post('/api/checkout',checkoutBody({code:other})),{store,loadCatalog})))).map(r=>r.status).sort();
  assert.deepEqual(statuses,[200,409]);
}));
test('El total del cliente no cuenta: el servidor recalcula y el número de pedido es del servidor',withEnv(checkoutEnv,async()=>{
  const store=freshStore();
  const response=await handleCheckout(post('/api/checkout',checkoutBody({total:1,discount:99,orderRef:'V-9999'})),{store,loadCatalog});
  const result=await response.json();
  assert.equal(result.total,360000);assert.equal(result.bulkDiscount,40000);assert.equal(result.orderRef,'V-0001');
  assert.equal((await handleCheckout(post('/api/checkout',checkoutBody({items:[{id:'A',quantity:4,expectedPrice:1}]})),{store,loadCatalog})).status,409);
}));
test('Carrito abandonado: solo con token de suscripto y se borra con la baja',withEnv({VERCEL:'1'},async()=>{
  const store=freshStore(),{sent,send}=mailbox();
  const {cartToken}=await (await welcomePOST(post('/api/welcome',signup('carrito@mail.com')),{store,send})).json();
  assert.equal((await cartSavePOST(post('/api/cart/save',{cartToken:'0'.repeat(64),items:[{id:'A',quantity:1}]}),{store})).status,404);
  assert.equal((await cartSavePOST(post('/api/cart/save',{cartToken,items:[{id:'A',quantity:2},{id:'<x>',quantity:1}]}),{store})).status,400);
  assert.equal((await cartSavePOST(post('/api/cart/save',{cartToken,items:[{id:'A',quantity:2}]}),{store})).status,200);
  assert.deepEqual([...store._db.carts.values()][0].items,[{id:'A',quantity:2}]);
  const unsub=await unsubscribePOST(new Request(`${SITE}/api/welcome/unsubscribe?t=${sent[0].unsubToken}`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:'List-Unsubscribe=One-Click'}),{store});
  assert.equal(unsub.status,200);assert.equal(store._db.carts.size,0);
  assert.equal((await cartSavePOST(post('/api/cart/save',{cartToken,items:[{id:'A',quantity:1}]}),{store})).status,404);
}));
