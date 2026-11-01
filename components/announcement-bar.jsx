import {BULK_DISCOUNT_FROM,FREE_SHIPPING_FROM,promoAmount} from '../lib/promos';
// Barra de promos en todo el sitio salvo el checkout. Un solo mensaje fijo (sin rotación), sin aria-live.
// Va dentro del bloque sticky del header (site-header.jsx). En mobile se acorta y nunca pasa a dos líneas.
// Los montos salen de lib/promos.js, la misma configuración que usa el carrito.
export default function AnnouncementBar() {
  return <div className="annc" role="region" aria-label="Promociones"><div className="annc-in">
    <p className="annc-msg"><b>Envío gratis</b> desde {promoAmount(FREE_SHIPPING_FROM)} <span className="sep" aria-hidden="true">·</span><span className="sr-only">,</span> <b>10% off</b><span className="annc-long"> en todo el carrito</span> desde {promoAmount(BULK_DISCOUNT_FROM)}</p>
  </div></div>;
}
