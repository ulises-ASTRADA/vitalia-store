'use client';
import {useState} from 'react';
import NextLink from 'next/link';
import Icon from './icon';
const Link=NextLink.default||NextLink;

export default function FloatingCart({count,total,money}) {
  const [open,setOpen]=useState(false);
  return <aside className="floating-cart-region" aria-label="Tu pedido">
    <button id="floating-cart" className={"floating-cart"+(open?" is-open":"")} aria-expanded={open} aria-label="Tu pedido">
      <div className="floating-cart-top" onClick={()=>setOpen(v=>!v)}>
        <Icon name="bag" className="floating-cart-icon"/>
        {count > 0 && <b className="floating-cart-badge">{count}</b>}
        <strong className="floating-cart-title">Mi pedido <b>{count}</b><span className="sr-only">presentaciones</span></strong>
        <button type="button" className="floating-cart-close" onClick={(e)=>{e.stopPropagation();setOpen(false);}} aria-label="Cerrar">-</button>
      </div>
      <div className="floating-cart-body" aria-hidden={!open}>
        <span>{count?`${count} ${count===1?'presentación':'presentaciones'}`:'Carrito vacío'}</span>
        <span className="floating-cart-total">{money(total)}</span>
        <Link href="/checkout" prefetch={false} className="floating-cart-checkout" onClick={()=>setOpen(false)}>Ir a mi pedido</Link>
      </div>
    </button>
  </aside>;
}
