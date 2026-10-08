'use client';
import {useMemo} from 'react';
import NextImage from 'next/image';
import NextLink from 'next/link';
import BoxBuilder from './box-builder';
import SectionNav from './section-nav';
import ThemeToggle from './theme-toggle';
import Icon from './icon';
import {useCart} from './use-cart';
const Image=NextImage.default||NextImage,Link=NextLink.default||NextLink;

export default function Boxes({initialCatalog}) {
  const {products,settings}=initialCatalog;
  const {loaded,count,total,addSelection}=useCart(products);
  const formatter=useMemo(()=>new Intl.NumberFormat('es-AR',{style:'currency',currency:settings.currency,maximumFractionDigits:2}),[settings.currency]);
  const money=value=>formatter.format(value);
  return <>
    <div className="sticky-header"><header className="checkout-header"><Link href="/" className="brand" aria-label="Vitalia, inicio"><Image className="brand-logo" src="/images/logo-web.webp" alt="Vitalia · Dietética" width={156} height={100} sizes="100px" loading="eager"/></Link><Link href="/" className="checkout-back">← Volver al catálogo</Link><ThemeToggle/></header><SectionNav current="boxes"/></div>
    <main className="shell boxes-page"><h1 className="sr-only">Boxes Vitalia</h1><BoxBuilder products={products} money={money} ready={loaded} onAdd={addSelection}/></main>
    <footer className="footer"><Link href="/" className="footer-brand">Vitalia</Link><p>Elegí. Sumá. Conversemos.</p></footer>
    <Link href="/checkout" prefetch={false} className="floating-cart" aria-label={count?`Ir a mi pedido, ${count} presentaciones, total ${money(total)}`:'Ir a mi pedido, carrito vacío'}><Icon name="bag"/><span className="floating-cart-copy"><strong>Mi pedido <b>{count}</b></strong><span>{count?`${count} ${count===1?'presentación':'presentaciones'}`:'Carrito vacío'}</span></span><span className="floating-cart-total">{money(total)}</span></Link>
  </>;
}
