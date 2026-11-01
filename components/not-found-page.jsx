'use client';
import {useEffect,useMemo,useState} from 'react';
import NextLink from 'next/link';
import SiteHeader from './site-header';
import SiteFooter from './site-footer';
import FloatingCart from './floating-cart';
import {ProductCard} from './product-card';
import {useCart} from './use-cart';
import {productPath} from '../lib/product-links';
const Link=NextLink.default||NextLink;

// 404 (spec de Pixel Mate): header completo con buscador, salida al catálogo, WhatsApp y 4 destacados.
export default function NotFoundPage({catalog,featured=[],storeWhatsappUrl=''}) {
  const products=catalog?.products||[];
  const {cart,loaded,count,total,change}=useCart(products,{catalogReady:Boolean(catalog)});
  const formatter=useMemo(()=>new Intl.NumberFormat('es-AR',{style:'currency',currency:catalog?.settings?.currency||'ARS',maximumFractionDigits:2}),[catalog]);
  const money=value=>formatter.format(value);
  const [toast,setToast]=useState('');
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),2300);return()=>clearTimeout(timer);},[toast]);
  function changeItem(product,delta){const error=change(product,delta);setToast(error||(delta>0?'Producto agregado a tu pedido':''));}
  return <>
    <a className="skip-link" href="#contenido">Ir al contenido</a>
    <SiteHeader catalog={catalog||undefined}/>
    <main className="shell not-found-page" id="contenido">
      <section className="not-found-hero" aria-labelledby="not-found-title">
        <p className="eyebrow muted">ERROR 404</p>
        <h1 id="not-found-title">No encontramos esta página</h1>
        <p>Puede que el producto ya no esté o que el link tenga un error. Buscalo acá arriba o mirá el catálogo.</p>
        <div className="not-found-actions"><Link className="primary" href="/#catalogo">Ver el catálogo</Link>{storeWhatsappUrl&&<a className="not-found-wa" href={storeWhatsappUrl} rel="noopener">Consultanos por WhatsApp</a>}</div>
      </section>
      {featured.length>0&&<section className="not-found-featured" aria-labelledby="not-found-featured-title"><h2 id="not-found-featured-title">Algunos de nuestros productos</h2>
        <div className="product-grid">{featured.map(product=><ProductCard key={product.id} product={product} quantity={loaded?cart[product.id]||0:0} money={money} change={changeItem} href={productPath(product)}/>)}</div>
      </section>}
    </main>
    <SiteFooter whatsappUrl={storeWhatsappUrl}/>
    {catalog&&<FloatingCart count={count} total={total} money={money}/>}
    <div className={`toast ${toast?'show':''}`} role="status" aria-live="polite">{toast}</div>
  </>;
}
