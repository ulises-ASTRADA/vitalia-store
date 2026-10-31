'use client';
import {useState} from 'react';
import NextLink from 'next/link';
import Icon from './icon';
const Link=NextLink.default||NextLink;

export default function FloatingCart({count,total,money}) {
  const [open,setOpen]=useState(false);
  return <aside className="floating-cart-region" aria-label="Tu pedido">
    <button id="floating-cart" className={"floating-cart"+(open?" is-open":"")} onClick={()=>setOpen(v=>!v)} aria-expanded={open} aria-label="Tu pedido">
      <div className="floating-cart-panel" aria-hidden={!open}>
        <div className="floating-cart-panel-inner">
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <Icon name="bag" className="floating-cart-icon"/>
            {count > 0 && <b className="floating-cart-badge">{count}</b>}
            <strong style={{margin:0}}>Mi pedido <b>{count}</b><span className="sr-only">presentaciones</span></strong>
          </div>
          <span>{count?`${count} ${count===1?'presentación':'presentaciones'}`:'Carrito vacío'}</span>
          <span className="floating-cart-total">{money(total)}</span>
          <Link href="/checkout" prefetch={false} className="floating-cart-checkout" onClick={()=>setOpen(false)}>Ir a mi pedido</Link>
        </div>
      </div>
    </button>
  </aside>;
}
