'use client';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import NextImage from 'next/image';
const Image = NextImage.default || NextImage;
import { Button, NativeSelect } from '@chakra-ui/react';
import SiteHeader from './site-header';
import SiteFooter from './site-footer';
import FloatingCart from './floating-cart';
import {useCart} from './use-cart';
import {ProductCard,Photo,pack} from './product-card';
import {productPath} from '../lib/product-links';
// Las tarjetas del home llevan a /productos/[slug]. Para volver al modal, poné false.
const CARDS_LINK_TO_PAGE=true;
const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const Modal=lazy(()=>import('./store-modal'));
export default function Store({initialCatalog=null,initialQuery='',whatsappUrl=''}) {
  const [products,setProducts]=useState(()=>initialCatalog?.products||[]), [settings,setSettings]=useState(()=>initialCatalog?.settings||{currency:'ARS',checkoutEnabled:false,name:'Vitalia'});
  const [status,setStatus]=useState(initialCatalog?'ready':'loading'),[category,setCategory]=useState('Todos'),[query,setQuery]=useState(initialQuery),[sort,setSort]=useState('catalog'),[limit,setLimit]=useState(24);
  const [detail,setDetail]=useState(null),[toast,setToast]=useState('');
  const [searchLayout,setSearchLayout]=useState(null);
  const searching=Boolean(query);
  const header=useRef(null),results=useRef(null),catalogLimit=useRef(24);
  const {cart,count,total,change:changeCart}=useCart(products,{catalogReady:status==='ready'});
  const loadCatalog=useCallback(async()=>{
    setStatus('loading');
    try {const response=await fetch('/api/catalog',{cache:'no-store'});if(!response.ok)throw Error();const data=await response.json();setProducts(data.products);setSettings(data.settings);setStatus('ready');return true;}
    catch {setStatus('error');setSettings(s=>({...s,checkoutEnabled:false}));return false;}
  },[]);
  useEffect(()=>{
    if(!initialCatalog)loadCatalog();
  },[loadCatalog,initialCatalog]);
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),2300);return()=>clearTimeout(timer);},[toast]);
  useEffect(()=>{document.title=`${settings.name} · Dietética`;},[settings.name]);
  useEffect(()=>{
    if(!searching)return;
    let frame;
    const compact=()=>{
      cancelAnimationFrame(frame);
      frame=requestAnimationFrame(()=>{
        const offset=Math.max(0,(header.current?.getBoundingClientRect().bottom||0)+16-(results.current?.getBoundingClientRect().top||0));
        // Al volver a subir, libera el espacio reservado sin mover el scroll.
        setSearchLayout(previous=>previous&&offset<previous.paddingTop?{paddingTop:offset,minHeight:`calc(${offset}px + 100dvh - var(--header-height))`}:previous);
      });
    };
    window.addEventListener('scroll',compact,{passive:true});
    return()=>{window.removeEventListener('scroll',compact);cancelAnimationFrame(frame);};
  },[searching]);
  const formatter=useMemo(()=>new Intl.NumberFormat('es-AR',{style:'currency',currency:settings.currency,maximumFractionDigits:2}),[settings.currency]);
  const money=value=>formatter.format(value);
  const filtered=useMemo(()=>{const result=products.filter(p=>(category==='Todos'||p.categoria===category)&&(!query||normalize([p.nombre,p.descripcion,p.categoria,p.id,p.presentacion].join(' ')).includes(normalize(query))));if(sort==='price-asc')result.sort((a,b)=>a.precio-b.precio);if(sort==='price-desc')result.sort((a,b)=>b.precio-a.precio);if(sort==='name')result.sort((a,b)=>a.nombre.localeCompare(b.nombre,'es'));return result;},[products,category,query,sort]);
  const categories=['Todos',...new Set(products.map(p=>p.categoria))];
  function updateQuery(value){
    if(value){
      if(!query)catalogLimit.current=limit;
      // Sitúa las coincidencias en la vista actual sin desplazar la página.
      const offset=Math.max(0,(header.current?.getBoundingClientRect().bottom||0)+16-(results.current?.getBoundingClientRect().top||0));
      setSearchLayout({paddingTop:offset,minHeight:`calc(${offset}px + 100dvh - var(--header-height))`});
    }else if(!value){
      setSearchLayout(null);
    }
    setQuery(value);
    setLimit(value?24:catalogLimit.current);
  }
  function change(product,delta){const error=changeCart(product,delta);setToast(error||(delta>0?'Producto agregado a tu pedido':''));}
  return <>
    <a className="skip-link" href="#catalogo">Ir al catálogo</a>
    <SiteHeader current="catalog" headerRef={header} query={query} onQueryChange={updateQuery}/>
    <main className="shell">
      <section className="hero" aria-labelledby="hero-title"><div className="hero-copy"><p className="eyebrow">EL ALMACÉN, A TU MANERA</p><h1 id="hero-title">Un buen pedido.<br/>Muchas cosas ricas.</h1><p>Elegí tus productos. Nosotros seguimos<br className="desktop-break"/> la conversación por WhatsApp.</p><a className="hero-link" href="#catalogo">Explorar el catálogo</a></div><div className="hero-photos" aria-hidden="true">{['023','002','037'].map((id,i)=><Image key={id} className={`hero-photo photo-${['one','two','three'][i]}`} src={`/images/product-${id}.webp`} width={240} height={250} alt="" sizes="(max-width: 760px) 180px, 240px" loading={i===0?'eager':'lazy'} fetchPriority={i===0?'high':'auto'}/>)}<span className="hero-stamp">PARA<br/>COMPARTIR<br/><b>Y DISFRUTAR</b></span></div></section>
      <section className="catalog-section" id="catalogo" aria-labelledby="catalog-title"><div className="catalog-top"><div><p className="eyebrow muted">ENCONTRÁ TUS FAVORITOS</p><h2 id="catalog-title">Nuestro catálogo<span>.</span></h2></div></div>
        <div className="catalog-layout"><aside className="categories"><h3>Categorías</h3><nav aria-label="Categorías de productos">{categories.map(name=><Button unstyled key={name} className="category-button" aria-pressed={name===category} onClick={()=>{setCategory(name);setLimit(24);}}><span>{name}</span><span className="category-count">{name==='Todos'?products.length:products.filter(p=>p.categoria===name).length}</span></Button>)}</nav><div className="side-note"><span className="tiny-rule"/><strong>De tu carrito<br/>a WhatsApp.</strong><p>Consultá disponibilidad y coordiná el pago y la entrega al enviar tu pedido.</p></div></aside>
        <div className="results" ref={results} style={searchLayout}><div className="results-toolbar"><p role="status" aria-live="polite">{status==='loading'?'Cargando productos…':status==='error'?'Catálogo no disponible':`${filtered.length} ${filtered.length===1?'producto':'productos'}${category==='Todos'?'':' · '+category}`}</p><label className="sort-label" htmlFor="sort">Ordenar <NativeSelect.Root className="chakra-sort" width={{base:'176px',sm:'188px'}}><NativeSelect.Field id="sort" value={sort} onChange={e=>{setSort(e.target.value);setLimit(24);}} bg="var(--surface)" color="var(--ink)" borderColor="var(--line)" paddingInlineStart="14px" paddingInlineEnd="44px" minHeight="44px"><option value="catalog">Según catálogo</option><option value="price-asc">Menor precio</option><option value="price-desc">Mayor precio</option><option value="name">Nombre: A a Z</option></NativeSelect.Field><NativeSelect.Indicator insetInlineEnd="14px" color="var(--ink)"/></NativeSelect.Root></label></div>
          {status==='error'?<div className="status-panel"><h3>No pudimos cargar el catálogo</h3><p>Intentá nuevamente en unos minutos.</p><Button unstyled onClick={loadCatalog}>Reintentar</Button></div>:status==='ready'&&!filtered.length?<div className="status-panel"><h3>No encontramos esos productos</h3><p>Probá con otra palabra o explorá todas las categorías.</p><Button unstyled onClick={()=>{updateQuery('');setCategory('Todos');}}>Ver todo el catálogo</Button></div>:<div className="product-grid" aria-busy={status==='loading'}>{filtered.slice(0,limit).map(product=><ProductCard key={product.id} product={product} quantity={cart[product.id]||0} money={money} change={change} href={CARDS_LINK_TO_PAGE?productPath(product):null} onDetail={setDetail}/>)}</div>}
          {filtered.length>limit&&<Button unstyled className="load-more" onClick={()=>setLimit(n=>n+24)}>Ver más productos ({Math.min(limit,filtered.length)} de {filtered.length})</Button>}
        </div></div>
      </section>
    </main>
    <SiteFooter whatsappUrl={whatsappUrl}/>
    <FloatingCart count={count} total={total} money={money}/>
    <div className={`toast ${toast?'show':''}`} role="status" aria-live="polite">{toast}</div>
    {detail&&<Suspense fallback={null}><Modal open={!!detail} onClose={()=>setDetail(null)} title={detail?.nombre||'Detalle de producto'}>{detail&&<div className="product-detail-layout"><Photo product={detail} className="detail-image" context="detail" eager frame={false}/><div className="detail-content"><p className="eyebrow muted">{detail.categoria}</p><h2>{detail.nombre}</h2><p className="detail-meta">{detail.id} · {pack(detail)}</p>{detail.descripcion&&<p className="detail-description">{detail.descripcion}</p>}<p className="detail-price">{money(detail.precio)}</p><p className="detail-meta">Precio por la presentación indicada. Moneda: {settings.currency}.</p><p className="detail-stock">{detail.disponibilidad==='disponible'?'Disponible según catálogo':detail.disponibilidad==='agotado'?'Agotado':'Disponibilidad a confirmar por WhatsApp'}</p><Button unstyled className="primary" disabled={detail.disponibilidad==='agotado'} onClick={()=>{change(detail,1);setDetail(null);}}>Agregar al pedido</Button></div></div>}</Modal></Suspense>}
  </>;
}
