import {StoreError} from './catalog.js';
import {priceCart} from './cart-offers.js';
export function makeOrder(body, products, settings) {
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
  let totalCents=0;
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
  let savingsCents=0;
  const lines=pricedItems.map(({product,quantity,subtotal,savings})=>{
    totalCents+=cents(subtotal);savingsCents+=cents(savings);
    const pack=product.presentacion ? ` (${product.presentacion})` : '';
    return `• ${quantity} × ${product.nombre}${pack}\n  ${product.id} · ${money(product.precio)} c/u · ${money(subtotal)}${savings?`\n  10% en una presentación sugerida · Ahorro: ${money(savings)}`:''}`;
  });
  const clean=s=>s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g,'').trim();
  const message=[settings.testCheckout?'PEDIDO DE PRUEBA — NO CONFIRMAR':null,`¡Hola, ${settings.name}! Quiero consultar este pedido:`,...lines,savingsCents?`Ahorro por sugerencias: ${money(savingsCents/100)}`:null,`Total: ${money(totalCents/100)}`,`Nombre: ${identity(body.name)}`,`Localidad: ${identity(body.locality)}`,`Provincia: ${identity(body.province)}`,body.notes.trim()?`Observaciones: ${clean(body.notes)}`:'','A confirmar: disponibilidad, envío y forma de pago.'].filter(Boolean).join('\n\n');
  // Sin emojis: el redirect de wa.me → api.whatsapp.com los reemplaza por U+FFFD (☘️ y ✅ llegaban como �).
  // Tildes, ¡, —, •, × y · sobreviven el redirect.
  const base=`https://wa.me/${settings.phone}`;
  const full=`${base}?text=${encodeURIComponent(message)}`;
  return {message,total:totalCents/100,savings:savingsCents/100,whatsappUrl:full};
}
