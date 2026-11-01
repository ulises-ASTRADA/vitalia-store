'use client';
import {useState} from 'react';
import NextLink from 'next/link';
import Icon from './icon';
const Link=NextLink.default||NextLink;

export default function FloatingCart({count,total,money}) {
  const [mobileOpen,setMobileOpen]=useState(false);
  const quantityLabel=`${count} ${count===1?'presentación':'presentaciones'}`;
  return <aside className="floating-cart-region" aria-label="Tu pedido">
    <Link href="/checkout" prefetch={false} id="floating-cart" className="floating-cart floating-cart-desktop">
      <Icon name="bag"/>
      <span className="floating-cart-copy"><strong>Mi pedido <b>{count}</b><span className="sr-only">presentaciones</span></strong><span>{count?quantityLabel:'Carrito vacío'}</span></span>
      <span className="floating-cart-total">{money(total)}</span>
    </Link>
    <div className="mobile-floating-cart">
      {mobileOpen?<div className="mobile-cart-panel" id="mobile-cart-details">
        <span className="mobile-cart-icon" aria-hidden="true"><Icon name="bag"/></span>
        <span className="mobile-cart-summary"><span>Total del pedido</span><strong>{money(total)}</strong></span>
        <Link href="/checkout" prefetch={false} className="mobile-cart-cta">Ir al carrito</Link>
        <button type="button" className="mobile-cart-minimize" aria-label="Minimizar resumen del pedido" aria-expanded="true" aria-controls="mobile-cart-details" onClick={()=>setMobileOpen(false)}>−</button>
      </div>:<button type="button" className="mobile-cart-bubble" aria-label={`Abrir resumen del pedido, ${quantityLabel}`} aria-expanded="false" aria-controls="mobile-cart-details" onClick={()=>setMobileOpen(true)}><Icon name="bag"/><span className="mobile-cart-badge" aria-hidden="true">{count}</span></button>}
    </div>
  </aside>;
}
