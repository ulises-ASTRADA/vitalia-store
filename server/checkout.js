import {storeSettings,StoreError} from '../lib/catalog.js';
import {getCachedCatalog} from '../lib/render-catalog.js';
import {allowedOrigin,limitRequest} from '../lib/request-security.js';
import {makeOrder} from '../lib/checkout.js';
import {isToken,newToken,normalizeCode,sha256} from '../lib/welcome-code.js';
import {growthStore} from './growth-store.js';
import {randomInt} from 'node:crypto';
import {appendOrder} from '../lib/orders.js';

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
    if (code) {
      let status;
      try {status=await store.reserveCode(code,reservationHash);}
      catch {throw new StoreError('No pudimos validar el código. Probá de nuevo en un rato.',503,'UNAVAILABLE',{codeToken});}
      if(status==='used') throw new StoreError('Este código ya se usó.',409,'CODE_USED');
      if(status==='unavailable') throw new StoreError('No pudimos validar el código. Probá de nuevo en un rato.',503,'UNAVAILABLE',{codeToken});
      if(status!=='ok') throw new StoreError('Código inválido o vencido.',409,'INVALID_CODE');
    }
    let orderRef;
    let recordSheet=true;
    try {
      const outcome=await store.createOrder({...draft.totals,code,items:draft.items,reservationHash});
      orderRef=outcome.ref;recordSheet=outcome.created!==false;
    }
    catch {
      if(!code){
        console.error('order store unavailable, using fallback ref');
        orderRef=fallbackRef();
      }else{
        let existing=null;
        try{existing=await store.orderRefForReservation(reservationHash);}
        catch(error){
          // 4xx: el INSERT no quedó escrito (columna ausente o dato rechazado). Se puede soltar la reserva.
          // Sin status (red caída) no se suelta: podría existir el pedido.
          if(error?.status>=400&&error?.status<500)await store.releaseCode(code,reservationHash).catch(()=>{});
          throw new StoreError('No pudimos preparar el pedido. Intentá nuevamente.',503,'UNAVAILABLE',{codeToken});
        }
        if(existing){orderRef=existing;recordSheet=false;}
        else{await store.releaseCode(code,reservationHash).catch(()=>{});throw new StoreError('No pudimos preparar el pedido. Intentá nuevamente.',503,'UNAVAILABLE',{codeToken});}
      }
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
