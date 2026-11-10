import {storeSettings,StoreError} from '../lib/catalog.js';
import {getCachedCatalog} from '../lib/render-catalog.js';
import {allowedOrigin,limitRequest} from '../lib/request-security.js';
import {makeOrder} from '../lib/checkout.js';
import {isToken,newToken,normalizeCode,sha256} from '../lib/welcome-code.js';
import {growthStore} from './growth-store.js';
import {randomInt} from 'node:crypto';
import {appendOrder} from '../lib/orders.js';

export function codedPayloadHash(draft, body) {
  const identity=value=>String(value??'').replace(/[\x00-\x1f\x7f]/g,' ').trim();
  const notes=String(body.notes??'').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g,'').trim();
  return sha256(JSON.stringify({
    name:identity(body.name),
    province:identity(body.province),
    notes,
    zone:draft.zone,
    locality:draft.locality,
    items:draft.items,
    grossCents:draft.totals.grossCents,
    suggestionCents:draft.totals.suggestionCents,
    bulkCents:draft.totals.bulkCents,
    codeCents:draft.totals.codeCents,
    totalCents:draft.totals.totalCents,
    freeShipping:draft.totals.freeShipping,
    shippingKind:draft.totals.shipping.kind,
    shippingCents:draft.totals.shippingCents,
    ...(typeof body.email==='string'?{email:identity(body.email)}:{}),
  }));
}

const safeLogMessage = (message) => String(message || '').replace(/([?&]key=)[^&\s'"]+/gi, '$1***').replace(/https?:\/\/\S+/gi, '[url]').slice(0, 120);

// Si la base no responde y el pedido no usa código, igual sale un número de referencia generado en el servidor.
const fallbackRef=()=>`V-X${Array.from({length:5},()=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[randomInt(32)]).join('')}`;

export const POST=request=>handleCheckout(request);
export async function handleCheckout(request,{store=growthStore(),loadCatalog=getCachedCatalog,recordOrder=appendOrder}={}) {
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
    const reservationHash=code?sha256(codeToken):null;
    const payloadHash=code?codedPayloadHash(draft, body):null;
    let orderRef;
    let recordSheet=true;
    try {
      if(code){
        const outcome=await store.prepareCodedOrder({code,reservationHash,payloadHash,totals:draft.totals,items:draft.items});
        if(outcome.status==='invalid') throw new StoreError('Código inválido o vencido.',409,'INVALID_CODE');
        if(outcome.status==='used') throw new StoreError('Este código ya se usó.',409,'CODE_USED');
        if(outcome.status==='mismatch') throw new StoreError(`Este código ya quedó en el pedido #${outcome.ref}, con otro contenido. Ese pedido no cambia.`,409,'ORDER_MISMATCH',{orderRef:outcome.ref});
        if(outcome.status!=='created'&&outcome.status!=='exists') throw new StoreError('No pudimos preparar el pedido. Intentá nuevamente.',503,'UNAVAILABLE',{codeToken});
        orderRef=outcome.ref;
        recordSheet=outcome.status==='created';
      }else{
        const outcome=await store.createOrder({...draft.totals,code,items:draft.items,reservationHash});
        orderRef=outcome.ref;recordSheet=outcome.created!==false;
      }
    }
    catch(error) {
      if(error instanceof StoreError) throw error;
      if(!code){
        console.error('order store unavailable, using fallback ref');
        orderRef=fallbackRef();
      }else throw new StoreError('No pudimos preparar el pedido. Intentá nuevamente.',503,'UNAVAILABLE',{codeToken});
    }
    if (isToken(body.cartToken)) await store.markCartConverted(body.cartToken).catch(()=>{});
    const {totals,items,...order}=makeOrder(body,products,settings,{orderRef,code});
    // Fila en la planilla de pedidos (ID VIT). El link de WhatsApp de la fila lleva el número de pedido (#V-…).
    // Si la planilla falla, el pedido sigue: el cliente igual lo manda por WhatsApp.
    const lookup=new Map(products.map(p=>[p.id,p]));
    const formattedItems=draft.items.map(({id,quantity})=>{
      const product=lookup.get(id);
      const pack=product?.presentacion?` (${product.presentacion})`:'';
      return `${quantity}x ${product?.nombre||id}${pack}`;
    }).join('; ');
    let orderId=null;
    try {
      // locality y shippingCost salen de makeOrder (recalculados en el servidor), no del body.
      // total = productos con descuentos; appendOrder suma el envío en la columna total.
      // Un reintento del mismo token no vuelve a escribir la fila: el pedido ya existe.
      if(recordSheet)orderId=await recordOrder({name:body.name,locality:order.locality,province:body.province,notes:body.notes,items:formattedItems,
        total:order.productsTotal,whatsappUrl:order.whatsappUrl,status:'Pendiente',shippingCost:order.shippingCost});
    } catch(err) {
      console.error('[vitalia] Error registrando pedido en Sheets:', `${err?.name || 'Error'}: ${safeLogMessage(err?.message)}`);
    }
    return Response.json({...order,orderId,...(codeToken?{codeToken}:{})},{headers:{'Cache-Control':'no-store'}});
  } catch(error) {
    console.error('[vitalia] checkout error', error instanceof StoreError ? error.message : `${error?.name || 'Error'}: ${safeLogMessage(error?.message)}`);
    const details=error instanceof StoreError&&error.details&&typeof error.details==='object'?error.details:{};
    return Response.json({error:error instanceof StoreError?error.message:'No pudimos preparar el pedido. Intentá nuevamente.',code:error.code||'UNAVAILABLE',...details},{status:error.status||503,headers:{'Cache-Control':'no-store'}});
  }
}
