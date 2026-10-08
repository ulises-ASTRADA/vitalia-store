import {getCatalog,storeSettings,StoreError} from '../lib/catalog.js';
import {makeOrder} from '../lib/checkout.js';
export async function POST(request) {
  try {
    const origin=request.headers.get('origin');
    const requestUrl=new URL(request.url);
    // Next.js puede usar localhost internamente; Host conserva el dominio solicitado.
    if (request.headers.get('host')) requestUrl.host=request.headers.get('host');
    if (origin && origin!==requestUrl.origin) throw new StoreError('Solicitud no permitida.',403);
    if (!(request.headers.get('content-type')||'').startsWith('application/json')) throw new StoreError('Formato no válido.',415);
    const text=await request.text();
    if (text.length>20000) throw new StoreError('El pedido es demasiado largo.',413);
    let body;
    try {body=JSON.parse(text);} catch {throw new StoreError('Pedido no válido.',400);}
    const settings=storeSettings();
    if (!settings.checkoutEnabled) throw new StoreError('Los pedidos por WhatsApp todavía no están habilitados.',503,'CHECKOUT_DISABLED');
    const {products}=await getCatalog({fresh:true});
    return Response.json(makeOrder(body,products,settings),{headers:{'Cache-Control':'no-store'}});
  } catch(error) {
    return Response.json({error:error instanceof StoreError?error.message:'No pudimos preparar el pedido. Intentá nuevamente.',code:error.code||'UNAVAILABLE'},{status:error.status||503,headers:{'Cache-Control':'no-store'}});
  }
}
