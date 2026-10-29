import {StoreError} from './catalog.js';
import {priceCart} from './cart-offers.js';
import {computeTotals,BULK_DISCOUNT_LABEL} from './promos.js';
// orderRef y code los resuelve el servidor (server/checkout.js). Acá solo se valida, se calcula y se arma el mensaje.
export function makeOrder(body, products, settings, {orderRef=null,code=null}={}) {
  if (!Array.isArray(body?.items) || !body.items.length || body.items.length > 50) throw new StoreError('Elegí entre 1 y 50 productos diferentes.',400,'INVALID_ORDER');
  const identity=s=>s.replace(/[\x00-\x1f\x7f]/g,' ').trim();
  for (const [key,label,max] of [['name','nombre',80],['locality','localidad',100],['province','provincia',100]]) {
    if (typeof body[key] !== 'string' || body[key].length > max || !identity(body[key])) throw new StoreError(`Completá correctamente tu ${label}.`,400,'INVALID_ORDER');
  }
  if (typeof body.notes !== 'string' || body.notes.length > 500) throw new StoreError('Revisá las observaciones del pedido.',400,'INVALID_ORDER');
  const lookup = new Map(products.map(p=>[p.id,p]));
  const seen = new Set();
  const cents = n=>Math.round(n*100);
  const money = n=>new Intl.NumberFormat('es-AR',{style:'currency',currency:settings.currency,maximumFractionDigits:2}).format(n).replace(/\s+/g,'');
  const validatedItems=body.items.map(item=>{
    if (!item || typeof item.id!=='string' || seen.has(item.id) || !Number.isInteger(item.quantity) || item.quantity<1 || item.quantity>99) throw new StoreError('Revisá las cantidades del pedido.',400,'INVALID_ORDER');
    seen.add(item.id);
    const product=lookup.get(item.id);
    if (!product || product.activo===false || product.disponibilidad==='agotado') throw new StoreError('Cambió la disponibilidad de un producto. Actualizá el carrito.',409,'CATALOG_CHANGED');
    if (typeof item.expectedPrice !== 'number' || !Number.isFinite(item.expectedPrice) || cents(item.expectedPrice)!==cents(product.precio)) throw new StoreError('Cambió un precio. Revisá el total actualizado antes de continuar.',409,'CATALOG_CHANGED');
    if(item.offerSourceId!==undefined && typeof item.offerSourceId!=='string') throw new StoreError('Revisá las sugerencias del pedido.',400,'INVALID_ORDER');
    return {product,quantity:item.quantity};
  });
  const offers=Object.fromEntries(body.items.filter(item=>item.offerSourceId!==undefined).map(item=>[item.id,item.offerSourceId]));
  const pricedItems=priceCart(validatedItems,offers);
  if(pricedItems.some(item=>Object.hasOwn(offers,item.product.id)&&!item.offerSourceId)) throw new StoreError('Cambió una sugerencia. Revisá el descuento antes de continuar.',409,'CATALOG_CHANGED');
  let grossCents=0,suggestionCents=0;
  const lines=pricedItems.map(({product,quantity,savings})=>{
    const lineCents=cents(product.precio)*quantity;
    grossCents+=lineCents;suggestionCents+=cents(savings);
    const pack=product.presentacion ? ` (${product.presentacion})` : '';
    return `- ${quantity} x ${product.nombre}${pack}: ${money(lineCents/100)}${savings?' (10% en una presentación sugerida)':''}`;
  });
  const totals=computeTotals({grossCents,suggestionCents,hasCode:Boolean(code)});
  const clean=s=>s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g,'').trim();
  const off=c=>`-${money(c/100)}`;
  const message=[
    settings.testCheckout?'PEDIDO DE PRUEBA — NO CONFIRMAR\n':null,
    `Hola ${settings.name}! Quiero hacer este pedido:`,
    orderRef?`Pedido #${orderRef}`:null,
    '',
    ...lines,
    '',
    `Subtotal: ${money(grossCents/100)}`,
    totals.suggestionCents?`Ahorro por sugerencias (10%): ${off(totals.suggestionCents)}`:null,
    totals.bulkCents?`${BULK_DISCOUNT_LABEL}: ${off(totals.bulkCents)}`:null,
    totals.codeCents?`Codigo de bienvenida ${code} (10%): ${off(totals.codeCents)}`:null,
    `Envio: ${totals.freeShipping?'Gratis':'Se coordina por WhatsApp'}`,
    `Total: ${money(totals.totalCents/100)}`,
    '',
    `Nombre: ${identity(body.name)}`,
    `Localidad: ${identity(body.locality)}`,
    `Provincia: ${identity(body.province)}`,
    body.notes.trim()?`Observaciones: ${clean(body.notes)}`:null,
    '',
    'A confirmar: disponibilidad, envío y forma de pago.',
  ].filter(line=>line!==null).join('\n');
  // Sin emojis: el redirect de wa.me → api.whatsapp.com los reemplaza por U+FFFD (☘️ y ✅ llegaban como �).
  // Formato del mensaje: spec del popup §6 (ASCII en las etiquetas, "-" para los descuentos).
  const base=`https://wa.me/${settings.phone}`;
  const full=`${base}?text=${encodeURIComponent(message)}`;
  const amount=c=>c/100;
  return {message,orderRef,code,whatsappUrl:full,items:validatedItems.map(({product,quantity})=>({id:product.id,quantity})),totals,
    subtotal:amount(grossCents),suggestionSavings:amount(totals.suggestionCents),bulkDiscount:amount(totals.bulkCents),codeDiscount:amount(totals.codeCents),
    freeShipping:totals.freeShipping,total:amount(totals.totalCents),savings:amount(totals.savingsCents)};
}
