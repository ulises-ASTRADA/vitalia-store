'use client';
import {useState} from 'react';
import NextLink from 'next/link';
import Icon from './icon';
const Link=NextLink.default||NextLink;

export default function FloatingCart({count,total,money}) {
  const [open,setOpen]=useState(false);
  return <aside className="floating-cart-region" aria-label="Tu pedido"><Link href="/checkout" prefetch={false} id="floating-cart" className="floating-cart" onClick={()=>setOpen(v=>!v)}>
    <Icon name="bag"/>
    {open && <span className="floating-cart-copy"><strong>Mi pedido <b>{count}</b><span className="sr-only">presentaciones</span></strong><span>{count?`${count} ${count===1?'presentación':'presentaciones'}`:'Carrito vacío'}</span></span>}
    {open && <span className="floating-cart-total">{money(total)}</span>}
  </Link></aside>;
}
