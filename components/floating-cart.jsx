'use client';
import {useState} from 'react';
import NextLink from 'next/link';
import Icon from './icon';
const Link=NextLink.default||NextLink;

export default function FloatingCart({count,total,money}) {
  const [open,setOpen]=useState(false);
  return <aside className="floating-cart-region" aria-label="Tu pedido">
    {open && <div className="floating-cart-panel">
      <div className="floating-cart-panel-inner">
        <strong>Mi pedido <b>{count}</b><span className="sr-only">presentaciones</span></strong>
        <span>{count?`${count} ${count===1?'presentación':'presentaciones'}`:'Carrito vacío'}</span>
        <span className="floating-cart-total">{money(total)}</span>
        <Link href="/checkout" prefetch={false} className="floating-cart-checkout">Ir a mi pedido</Link>
      </div>
    </div>}
    <button id="floating-cart" className="floating-cart" onClick={()=>setOpen(v=>!v)} aria-expanded={open} aria-label="Tu pedido">
      <Icon name="bag"/>
      {count > 0 && <b className="floating-cart-badge">{count}</b>}
    </button>
  </aside>;
}
