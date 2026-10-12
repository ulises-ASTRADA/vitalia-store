'use client';
import {useMemo} from 'react';
import NextLink from 'next/link';
import BoxBuilder from './box-builder';
import SiteHeader from './site-header';
import Icon from './icon';
import {useCart} from './use-cart';
const Link=NextLink.default||NextLink;

export default function Boxes({initialCatalog}) {
  const {products,settings}=initialCatalog;
  const {loaded,count,total,addSelection}=useCart(products);
  const formatter=useMemo(()=>new Intl.NumberFormat('es-AR',{style:'currency',currency:settings.currency,maximumFractionDigits:2}),[settings.currency]);
  const money=value=>formatter.format(value);
  return <>
    <SiteHeader current="boxes"/>
    <main className="shell boxes-page"><h1 className="sr-only">Boxes Vitalia</h1><BoxBuilder products={products} money={money} ready={loaded} onAdd={addSelection}/></main>
    <footer className="footer"><Link href="/" className="footer-brand">Vitalia</Link><p>Elegí. Sumá. Conversemos.</p></footer>
    <Link href="/checkout" prefetch={false} className="floating-cart" aria-label={count?`Ir a mi pedido, ${count} presentaciones, total ${money(total)}`:'Ir a mi pedido, carrito vacío'}><Icon name="bag"/><span className="floating-cart-copy"><strong>Mi pedido <b>{count}</b></strong><span>{count?`${count} ${count===1?'presentación':'presentaciones'}`:'Carrito vacío'}</span></span><span className="floating-cart-total">{money(total)}</span></Link>
  </>;
}
