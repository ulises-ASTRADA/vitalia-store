import {isIP} from 'node:net';

export function allowedOrigin(request) {
  const origin=request.headers.get('origin');
  const origins=new Set(['https://www.vitalia.energy','https://vitalia.energy']);
  if(process.env.VERCEL_ENV!=='production'&&process.env.VERCEL_URL)origins.add(`https://${process.env.VERCEL_URL}`);
  if(process.env.VERCEL!=='1'){
    const url=new URL(request.url);
    if(['localhost','127.0.0.1','[::1]'].includes(url.hostname))for(const host of ['localhost','127.0.0.1','[::1]'])origins.add(`${url.protocol}//${host}${url.port?':'+url.port:''}`);
  }
  return Boolean(origin&&origins.has(origin));
}

// Defensa por instancia, no reemplaza el límite distribuido del WAF de Vercel.
const buckets=new Map();
export function limitRequest(request,route,limit,now=Date.now()) {
  for(const [key,bucket] of buckets)if(bucket.until<=now)buckets.delete(key);
  const forwarded=process.env.VERCEL==='1'?request?.headers.get('x-vercel-forwarded-for')?.split(',')[0].trim():'';
  const key=`${route}:${isIP(forwarded||'')?forwarded:'unknown'}`;
  if(!buckets.has(key)){
    if(buckets.size>=10000)return Response.json({error:'Demasiadas solicitudes. Intentá nuevamente en un minuto.'},{status:429,headers:{'Retry-After':'60','Cache-Control':'no-store'}});
    buckets.set(key,{count:0,until:now+60000});
  }
  const bucket=buckets.get(key);
  if(++bucket.count<=limit)return null;
  return Response.json({error:'Demasiadas solicitudes. Intentá nuevamente en un minuto.'},{status:429,headers:{'Retry-After':String(Math.ceil((bucket.until-now)/1000)),'Cache-Control':'no-store'}});
}

// IP del cliente: solo se confía en el header de Vercel cuando corre en Vercel.
export function clientIp(request) {
  const forwarded=process.env.VERCEL==='1'?request?.headers.get('x-vercel-forwarded-for')?.split(',')[0].trim():'';
  return isIP(forwarded||'')?forwarded:'unknown';
}
// Límite por clave (IP, mail) con ventana configurable. Por instancia, igual que limitRequest.
const keyed=new Map();
export function limitKey(key,limit,windowMs,now=Date.now()) {
  if(keyed.size>=10000)for(const [k,b] of keyed)if(b.until<=now)keyed.delete(k);
  if(keyed.size>=10000)return true;
  let bucket=keyed.get(key);
  if(!bucket||bucket.until<=now){bucket={count:0,until:now+windowMs};keyed.set(key,bucket);}
  return ++bucket.count>limit;
}
export const tooMany=()=>Response.json({error:'Probá de nuevo en unos minutos.',code:'RATE_LIMITED'},{status:429,headers:{'Retry-After':'600','Cache-Control':'no-store'}});
