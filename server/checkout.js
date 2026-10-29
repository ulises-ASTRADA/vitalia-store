import {storeSettings,StoreError} from '../lib/catalog.js';
import {getCachedCatalog} from '../lib/render-catalog.js';
import {allowedOrigin,limitRequest} from '../lib/request-security.js';
import {makeOrder} from '../lib/checkout.js';
import {isToken,newToken,normalizeCode,sha256} from '../lib/welcome-code.js';
import {growthStore} from './growth-store.js';
import {randomInt} from 'node:crypto';

// Si la base no responde y el pedido no usa código, igual sale un número de referencia generado en el servidor.
const fallbackRef=()=>`V-X${Array.from({length:5},()=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[randomInt(32)]).join('')}`;

export const POST=request=>handleCheckout(request);
export async function handleCheckout(request,{store=growthStore(),loadCatalog=getCachedCatalog}={}) {
  try {
    if (!allowedOrigin(request)) throw new StoreError('Solicitud no permitida.',403);
    const limited=limitRequest(request,'checkout',30);if(limited)return limited;
    if (!(request.headers.get('content-type')||'').startsWith('application/json')) throw new StoreError('Formato no válido.',415);
    const text=await request.text();
    if (text.length>20000) throw new StoreError('El pedido es demasiado largo.',413);
    let body;
    try {body=JSON.parse(text);} catch {throw new StoreError('Pedido no válido.',400);}
    const settings=storeSettings();
    if (!settings.checkoutEnabled) throw new StoreError('Los pedidos por WhatsApp todavía no están habilitados.',503,'CHECKOUT_DISABLED');
    let code=null;
    if (body?.code!==undefined&&body.code!==null&&body.code!=='') {
      code=normalizeCode(body.code);
      if(!code) throw new StoreError('Código inválido o vencido.',400,'INVALID_CODE');
    }
    const {products}=await loadCatalog();
    // Primero valida todo (precios, cantidades, sugerencias) sin tocar el código.
    const draft=makeOrder(body,products,settings,{code});
    const codeToken=code?(isToken(body.codeToken)?body.codeToken:newToken()):null;
    if (code) {
      let status;
      try {status=await store.reserveCode(code,sha256(codeToken));}
      catch {throw new StoreError('No pudimos validar el código. Probá de nuevo en un rato.',503,'UNAVAILABLE');}
      if(status==='used') throw new StoreError('Este código ya se usó.',409,'CODE_USED');
      if(status!=='ok') throw new StoreError('Código inválido o vencido.',409,'INVALID_CODE');
    }
    let orderRef;
    try {orderRef=await store.createOrder({...draft.totals,code,items:draft.items});}
    catch {
      if(code){await store.releaseCode(code,sha256(codeToken)).catch(()=>{});throw new StoreError('No pudimos preparar el pedido. Intentá nuevamente.',503,'UNAVAILABLE');}
      console.error('order store unavailable, using fallback ref');
      orderRef=fallbackRef();
    }
    if (isToken(body.cartToken)) await store.markCartConverted(body.cartToken).catch(()=>{});
    const {totals,items,...order}=makeOrder(body,products,settings,{orderRef,code});
    return Response.json({...order,...(codeToken?{codeToken}:{})},{headers:{'Cache-Control':'no-store'}});
  } catch(error) {
    return Response.json({error:error instanceof StoreError?error.message:'No pudimos preparar el pedido. Intentá nuevamente.',code:error.code||'UNAVAILABLE'},{status:error.status||503,headers:{'Cache-Control':'no-store'}});
  }
}
