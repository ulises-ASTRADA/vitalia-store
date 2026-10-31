'use client';
import NextLink from 'next/link';
import Icon from './icon';
const Link=NextLink.default||NextLink;

export default function FloatingCart({count,total,money}) {
  return <aside className="floating-cart-region" aria-label="Tu pedido"><Link href="/checkout" prefetch={false} id="floating-cart" className="floating-cart">
    <Icon name="bag"/>
    <span className="floating-cart-copy"><strong>Mi pedido <b>{count}</b><span className="sr-only">presentaciones</span></strong><span>{count?`${count} ${count===1?'presentación':'presentaciones'}`:'Carrito vacío'}</span></span>
    <span className="floating-cart-total">{money(total)}</span>
  </Link></aside>;
}
