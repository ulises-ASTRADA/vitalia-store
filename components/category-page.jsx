'use client';
import {useEffect,useMemo,useState} from 'react';
import NextLink from 'next/link';
import {Button,NativeSelect} from '@chakra-ui/react';
import SiteHeader from './site-header';
import FloatingCart from './floating-cart';
import ShipLine from './ship-line';
import {ProductCard} from './product-card';
import {useCart} from './use-cart';
import {productPath} from '../lib/product-links';
const Link=NextLink.default||NextLink;

// categories: [{name,slug,count,href}]. Los productos sin página propia quedan en la grilla, sin link.
export default function CategoryPage({catalog,category,categories}) {
  const {products,settings}=catalog;
  const {cart,loaded,count,total,change}=useCart(products);
  const formatter=useMemo(()=>new Intl.NumberFormat('es-AR',{style:'currency',currency:settings.currency,maximumFractionDigits:2}),[settings.currency]);
  const money=value=>formatter.format(value);
  const [sort,setSort]=useState('catalog'),[limit,setLimit]=useState(24),[toast,setToast]=useState('');
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),2300);return()=>clearTimeout(timer);},[toast]);
  const items=useMemo(()=>{const result=products.filter(p=>p.categoria===category.name);if(sort==='price-asc')result.sort((a,b)=>a.precio-b.precio);if(sort==='price-desc')result.sort((a,b)=>b.precio-a.precio);if(sort==='name')result.sort((a,b)=>a.nombre.localeCompare(b.nombre,'es'));return result;},[products,category.name,sort]);
  function changeItem(product,delta){const error=change(product,delta);setToast(error||(delta>0?'Producto agregado a tu pedido':''));}
  return <>
    <a className="skip-link" href="#contenido">Ir al contenido</a>
    <SiteHeader current="catalog"/>
    <main className="shell category-page" id="contenido">
      <nav className="breadcrumb" aria-label="Ruta de navegación"><ol><li><Link href="/">Inicio</Link></li><li><span aria-current="page">{category.name}</span></li></ol></nav>
      <header className="category-head"><p className="eyebrow muted">CATEGORÍA</p><h1>{category.name}<span aria-hidden="true">.</span></h1>{category.intro&&<p className="category-intro">{category.intro}</p>}</header>
      <div className="catalog-layout"><aside className="categories"><h3>Categorías</h3><nav aria-label="Categorías de productos"><Link className="category-button" href="/"><span>Todos</span><span className="category-count">{products.length}</span></Link>{categories.map(c=><Link key={c.slug} className="category-button" href={c.href} aria-current={c.slug===category.slug?'page':undefined}><span>{c.name}</span><span className="category-count">{c.count}</span></Link>)}</nav><div className="side-note"><span className="tiny-rule"/><strong>De tu carrito<br/>a WhatsApp.</strong><p>Consultá disponibilidad y coordiná el pago y la entrega al enviar tu pedido.</p></div></aside>
        <div className="results"><div className="results-toolbar"><p role="status" aria-live="polite">{`${items.length} ${items.length===1?'producto':'productos'} · ${category.name}`}</p><label className="sort-label" htmlFor="sort">Ordenar <NativeSelect.Root className="chakra-sort" width={{base:'176px',sm:'188px'}}><NativeSelect.Field id="sort" value={sort} onChange={e=>{setSort(e.target.value);setLimit(24);}} bg="var(--surface)" color="var(--ink)" borderColor="var(--line)" paddingInlineStart="14px" paddingInlineEnd="44px" minHeight="44px"><option value="catalog">Según catálogo</option><option value="price-asc">Menor precio</option><option value="price-desc">Mayor precio</option><option value="name">Nombre: A a Z</option></NativeSelect.Field><NativeSelect.Indicator insetInlineEnd="14px" color="var(--ink)"/></NativeSelect.Root></label></div>
          <div className="product-grid">{items.slice(0,limit).map(product=><ProductCard key={product.id} product={product} quantity={loaded?cart[product.id]||0:0} money={money} change={changeItem} href={productPath(product)}/>)}</div>
          {items.length>limit&&<Button unstyled className="load-more" onClick={()=>setLimit(n=>n+24)}>Ver más productos ({Math.min(limit,items.length)} de {items.length})</Button>}
          <ShipLine band/>
        </div></div>
    </main>
    <footer className="footer"><Link href="/" className="footer-brand">Vitalia</Link><p>Elegí. Sumá. Conversemos.</p></footer>
    <FloatingCart count={count} total={total} money={money}/>
    <div className={`toast ${toast?'show':''}`} role="status" aria-live="polite">{toast}</div>
  </>;
}
