import {complementaryCategories} from './recommendations.js';

// El precio del catálogo nunca cambia. La oferta cubre una presentación aceptada.
export function offerPrice(price) {
  return Math.round(Math.round(price*100)*90/100)/100;
}
export function canOffer(product, source) {
  return product && source && product.id!==source.id && product.activo!==false && source.activo!==false && product.disponibilidad!=='agotado' && source.disponibilidad!=='agotado' && (complementaryCategories[source.categoria]||[]).includes(product.categoria);
}
export function priceCart(items, offers={}) {
  return items.map(item=>{
    const source=items.find(other=>other.product.id===offers[item.product.id]);
    const offerSourceId=source && !offers[source.product.id] && canOffer(item.product,source.product)?source.product.id:null;
    const originalCents=Math.round(item.product.precio*100)*item.quantity;
    const savingsCents=offerSourceId?Math.round(item.product.precio*100)-Math.round(offerPrice(item.product.precio)*100):0;
    return {...item,offerSourceId,savings:savingsCents/100,subtotal:(originalCents-savingsCents)/100};
  });
}
