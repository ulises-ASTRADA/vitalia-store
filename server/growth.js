// Endpoints del growth pack: alta del popup, validación del código, carrito abandonado y baja.
import {allowedOrigin,clientIp,limitKey,tooMany} from '../lib/request-security.js';
import {CONSENT_TEXT,cleanName,isToken,normalizeCode,normalizeEmail,sha256} from '../lib/welcome-code.js';
import {growthStore,GrowthUnavailable} from './growth-store.js';
import {sendWelcomeEmail} from './mailer.js';

const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const generic=()=>json({error:'No pudimos mandarte el código. Probá de nuevo en un rato.',code:'UNAVAILABLE'},503);
async function readJson(request,max=4000) {
  if(!(request.headers.get('content-type')||'').startsWith('application/json'))return null;
  const text=await request.text();
  if(text.length>max)return null;
  try{const body=JSON.parse(text);return body&&typeof body==='object'&&!Array.isArray(body)?body:null;}catch{return null;}
}

export async function welcomePOST(request,{store=growthStore(),send=sendWelcomeEmail,now=Date.now()}={}) {
  if(!allowedOrigin(request))return json({error:'Solicitud no permitida.'},403);
  const ip=clientIp(request);
  if(limitKey(`welcome:ip:${ip}`,5,10*60000,now))return tooMany();
  const body=await readJson(request);
  if(!body)return json({error:'Revisá los datos del formulario.',code:'INVALID'},400);
  // Honeypot: un bot que completa "website" recibe una respuesta igual a la real y no se guarda nada.
  if(typeof body.website==='string'&&body.website.trim())return json({ok:true});
  const name=cleanName(body.name);
  if(!name)return json({error:'Contanos cómo te llamás.',code:'INVALID_NAME',field:'name'},400);
  const email=normalizeEmail(body.email);
  if(!email)return json({error:'Revisá el mail: falta la @ o el dominio (ej.: tu@mail.com).',code:'INVALID_EMAIL',field:'email'},400);
  if(body.consent!==true)return json({error:'Para mandarte el código necesitamos que aceptes recibir mails.',code:'CONSENT_REQUIRED',field:'consent'},400);
  if(limitKey(`welcome:email:${sha256(email)}`,3,60*60000,now))return tooMany();
  try{
    const result=await store.signup({name,email,consentText:CONSENT_TEXT,now});
    if(result.status==='exists')return json({error:'Este mail ya recibió el código de bienvenida.',detail:'Si no lo encontrás, buscalo en spam o promociones.',code:'ALREADY_SUBSCRIBED'},409);
    const sent=await send({to:email,name,code:result.code,unsubToken:result.unsubToken});
    if(!sent){await store.removeSubscriber(result.id).catch(()=>{});return generic();}
    // El código nunca vuelve al navegador: solo el token opaco para guardar el carrito.
    return json({ok:true,cartToken:result.cartToken});
  }catch(error){if(!(error instanceof GrowthUnavailable))console.error('welcome signup failed');return generic();}
}

export async function codePOST(request,{store=growthStore(),now=Date.now()}={}) {
  if(!allowedOrigin(request))return json({error:'Solicitud no permitida.'},403);
  if(limitKey(`code:ip:${clientIp(request)}`,10,10*60000,now))return tooMany();
  const body=await readJson(request,1000);
  const code=normalizeCode(body?.code);
  if(!code)return json({error:'Código inválido o vencido.',code:'INVALID_CODE'},400);
  const reservation=isToken(body.codeToken)?sha256(body.codeToken):undefined;
  try{
    const status=await store.codeStatus(code,reservation,now);
    if(status==='used')return json({error:'Este código ya se usó.',code:'CODE_USED'},409);
    if(status!=='ok')return json({error:'Código inválido o vencido.',code:'INVALID_CODE'},404);
    return json({ok:true,code,rate:10});
  }catch{return json({error:'No pudimos validar el código. Probá de nuevo en un rato.',code:'UNAVAILABLE'},503);}
}

export function cleanCartItems(items) {
  if(!Array.isArray(items)||items.length>50)return null;
  const seen=new Set();
  for(const item of items){
    if(!item||typeof item.id!=='string'||!/^[A-Za-z0-9_-]{1,60}$/.test(item.id)||seen.has(item.id)||!Number.isInteger(item.quantity)||item.quantity<1||item.quantity>99)return null;
    seen.add(item.id);
  }
  return items.map(({id,quantity})=>({id,quantity}));
}

// Carrito abandonado: solo con el token que recibió quien se suscribió (con consentimiento) y no se dio de baja.
export async function cartSavePOST(request,{store=growthStore(),now=Date.now()}={}) {
  if(!allowedOrigin(request))return json({error:'Solicitud no permitida.'},403);
  if(limitKey(`cart:ip:${clientIp(request)}`,30,60000,now))return tooMany();
  const body=await readJson(request,8000);
  const items=cleanCartItems(body?.items);
  if(!isToken(body?.cartToken)||!items)return json({error:'Carrito no válido.'},400);
  try{
    const saved=await store.saveCart(body.cartToken,items,now);
    return saved?json({ok:true}):json({error:'Sin suscripción activa.',code:'NOT_SUBSCRIBED'},404);
  }catch{return json({error:'No disponible.'},503);}
}

const page=(title,body,status=200)=>new Response(`<!doctype html><html lang="es-AR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title} · Vitalia</title></head><body style="font-family:Arial,Helvetica,sans-serif;color:#22362a;max-width:480px;margin:48px auto;padding:0 20px;line-height:1.5">${body}<p><a href="/" style="color:#233a29">Volver a la tienda</a></p></body></html>`,{status,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"}});

// GET muestra un botón (los antivirus de mail abren los links y no deben dar de baja a nadie).
export async function unsubscribeGET(request) {
  const token=new URL(request.url).searchParams.get('t');
  if(!isToken(token))return page('Link no válido','<h1>Link no válido</h1><p>Revisá que el link del mail esté completo.</p>',400);
  return page('Darme de baja',`<h1>¿Te damos de baja?</h1><p>No te vamos a mandar más mails de novedades ni promos.</p><form method="post" action="/api/welcome/unsubscribe?t=${token}"><button type="submit" style="font:inherit;font-weight:700;background:#233a29;color:#fff;border:0;border-radius:8px;padding:12px 20px">Darme de baja</button></form>`);
}
// POST: el botón de la página o el "List-Unsubscribe-Post" de un clic. El token es la autorización.
export async function unsubscribePOST(request,{store=growthStore(),now=Date.now()}={}) {
  if(limitKey(`unsub:ip:${clientIp(request)}`,20,60000,now))return tooMany();
  const token=new URL(request.url).searchParams.get('t');
  if(!isToken(token))return page('Link no válido','<h1>Link no válido</h1><p>Revisá que el link del mail esté completo.</p>',400);
  try{
    await store.unsubscribe(token,now);
    return page('Listo','<h1>Listo, te diste de baja.</h1><p>No vas a recibir más mails de Vitalia.</p>');
  }catch{return page('Probá más tarde','<h1>No pudimos darte de baja</h1><p>Probá de nuevo en un rato o escribinos a hola@vitalia.energy.</p>',503);}
}
