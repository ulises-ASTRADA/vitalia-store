import {BULK_DISCOUNT_FROM,FREE_SHIPPING_FROM,promoAmount} from '../lib/promos';
// Barra de promos en todo el sitio. Un solo mensaje fijo (sin rotación). No es sticky ni aria-live.
// Los montos salen de lib/promos.js, la misma configuración que usa el carrito.
export default function AnnouncementBar() {
  return <div className="annc" role="region" aria-label="Promociones"><div className="annc-in">
    <p className="annc-msg"><b>Envío gratis</b> desde {promoAmount(FREE_SHIPPING_FROM)} <span className="sep" aria-hidden="true">·</span><span className="sr-only">,</span> <b>10% off</b> en todo el carrito desde {promoAmount(BULK_DISCOUNT_FROM)}</p>
  </div></div>;
}
