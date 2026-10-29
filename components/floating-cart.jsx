'use client';
import NextLink from 'next/link';
import Icon from './icon';
const Link=NextLink.default||NextLink;

// Sin aria-label: el nombre accesible es el texto visible (WCAG 2.5.3). El <aside> es el landmark.
export default function FloatingCart({count,total,money}) {
  return <aside className="floating-cart-region" aria-label="Tu pedido"><Link href="/checkout" prefetch={false} id="floating-cart" className="floating-cart"><Icon name="bag"/><span className="floating-cart-copy"><strong>Mi pedido <b>{count}</b>{' '}<span className="sr-only">productos</span></strong>{' '}<span>{count?`${count} ${count===1?'presentación':'presentaciones'}`:'Carrito vacío'}</span></span>{' '}<span className="floating-cart-total">{money(total)}</span></Link></aside>;
}
