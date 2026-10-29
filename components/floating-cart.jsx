'use client';
import NextLink from 'next/link';
import Icon from './icon';
const Link=NextLink.default||NextLink;

export default function FloatingCart({count,total,money}) {
  return <Link href="/checkout" prefetch={false} id="floating-cart" className="floating-cart" aria-label={count?`Ir a mi pedido, ${count} presentaciones, total ${money(total)}`:'Ir a mi pedido, carrito vacío'}><Icon name="bag"/><span className="floating-cart-copy"><strong>Mi pedido <b>{count}</b></strong><span>{count?`${count} ${count===1?'presentación':'presentaciones'}`:'Carrito vacío'}</span></span><span className="floating-cart-total">{money(total)}</span></Link>;
}
