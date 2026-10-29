// Promos de Vitalia: una sola fuente para la barra de anuncios, el carrito y el servidor.
// Los montos se calculan en centavos. El servidor recalcula todo; el navegador solo muestra una vista previa.
import {FREE_SHIPPING_FROM} from './envios.js';

export {FREE_SHIPPING_FROM};
export const BULK_DISCOUNT_FROM=400000;
export const BULK_DISCOUNT_RATE=10;
export const WELCOME_CODE_RATE=10;
export const BULK_DISCOUNT_LABEL='Descuento por compra desde $400.000 (10%)';
export const WELCOME_CODE_LABEL='Código de bienvenida (10%)';

const tenPercent=cents=>Math.round(cents*BULK_DISCOUNT_RATE/100);

// grossCents: suma de precio minorista × cantidad (antes de cualquier descuento).
// suggestionCents: ahorro de las sugerencias del carrito (10% en una presentación), se mantiene aparte.
// Cada descuento es el 10% del subtotal de productos, redondeado por separado: nunca compuesto.
// El envío no entra en la base de ningún descuento. Debajo de $70.000 el costo se coordina por WhatsApp.
export function computeTotals({grossCents,suggestionCents=0,hasCode=false}) {
  if(!Number.isInteger(grossCents)||grossCents<0||!Number.isInteger(suggestionCents)||suggestionCents<0)throw new TypeError('Montos inválidos.');
  const bulkCents=grossCents>=BULK_DISCOUNT_FROM*100?tenPercent(grossCents):0;
  const codeCents=hasCode?Math.round(grossCents*WELCOME_CODE_RATE/100):0;
  const freeShipping=grossCents>=FREE_SHIPPING_FROM*100;
  const savingsCents=suggestionCents+bulkCents+codeCents;
  return {grossCents,suggestionCents,bulkCents,codeCents,freeShipping,savingsCents,totalCents:grossCents-savingsCents};
}

// Una sola meta por vez: primero envío gratis, después el 10% off.
export function nextGoal(grossCents) {
  if(grossCents<FREE_SHIPPING_FROM*100)return {kind:'shipping',missingCents:FREE_SHIPPING_FROM*100-grossCents,progress:grossCents/(FREE_SHIPPING_FROM*100)};
  if(grossCents<BULK_DISCOUNT_FROM*100)return {kind:'bulk',missingCents:BULK_DISCOUNT_FROM*100-grossCents,progress:grossCents/(BULK_DISCOUNT_FROM*100)};
  return {kind:'done',missingCents:0,progress:1};
}

export const promoAmount=n=>`$${new Intl.NumberFormat('es-AR',{maximumFractionDigits:0}).format(n)}`;
