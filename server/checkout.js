import {storeSettings,StoreError} from '../lib/catalog.js';
import {getCachedCatalog} from '../lib/render-catalog.js';
import {allowedOrigin,limitRequest} from '../lib/request-security.js';
import {makeOrder} from '../lib/checkout.js';
import {appendOrder} from '../lib/orders.js';
export async function POST(request) {
  try {
    if (!allowedOrigin(request)) throw new StoreError('Solicitud no permitida.',403);
    const limited=limitRequest(request,'checkout',30);if(limited)return limited;
    if (!(request.headers.get('content-type')||'').startsWith('application/json')) throw new StoreError('Formato no válido.',415);
    const text=await request.text();
    if (text.length>20000) throw new StoreError('El pedido es demasiado largo.',413);
    let body;
    try {body=JSON.parse(text);} catch {throw new StoreError('Pedido no válido.',400);}
    const settings=storeSettings();
    console.log(`[vitalia] checkout phone=${(settings.phone||'').length>=3?settings.phone.slice(0,3)+'***':settings.phone}`);
    if (!settings.checkoutEnabled) throw new StoreError('Los pedidos por WhatsApp todavía no están habilitados.',503,'CHECKOUT_DISABLED');
    const {products}=await getCachedCatalog();
    const result=makeOrder(body,products,settings);
    const lineCount = Array.isArray(body?.items) ? body.items.length : 0;
    const orderId = await appendOrder({
      name: body?.name,
      locality: body?.locality,
      province: body?.province,
      notes: body?.notes,
      items: `${lineCount} items · total ${result.total}`,
      total: result.total,
      whatsappUrl: result.whatsappUrl
    });
    return Response.json({...result, orderId}, {headers:{'Cache-Control':'no-store'}});
  } catch(error) {
    return Response.json({error:error instanceof StoreError?error.message:'No pudimos preparar el pedido. Intentá nuevamente.',code:error.code||'UNAVAILABLE'},{status:error.status||503,headers:{'Cache-Control':'no-store'}});
  }
}
