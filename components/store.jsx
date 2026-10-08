'use client';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import NextImage from 'next/image';
const Image = NextImage.default || NextImage;
import { Button, IconButton, Input, NativeSelect } from '@chakra-ui/react';
import { useTheme } from 'next-themes';
import NextLink from 'next/link';
const Link=NextLink.default||NextLink;
import {useCart} from './use-cart';
import BoxBuilder from './box-builder';
const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const pack = product => product.presentacion || 'Presentación a confirmar';
function Icon({name}) {
  const paths={bag:<><path d="M5 7h14l1 14H4L5 7Z"/><path d="M9 8V5a3 3 0 0 1 6 0v3"/></>,search:<><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,sun:<><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></>,moon:<path d="M20.6 13.5A9 9 0 0 1 10.5 3.4a9 9 0 1 0 10.1 10.1Z"/>};
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}
function Photo({product,className='',eager=false,context='card'}) {
  const [broken,setBroken]=useState(false);
  const src=broken?'/images/logo-web.webp':product.imagen||'/images/logo-web.webp';
  const sizes=context==='detail'?'(max-width: 760px) calc(100vw - 88px), 400px':context==='cart'?'64px':'(max-width: 540px) calc((100vw - 48px)/2), (max-width: 1050px) 30vw, 260px';
  return <Image src={src} alt={product.nombre} width={context==='detail'?800:360} height={context==='detail'?780:350} sizes={sizes} unoptimized={!src.startsWith('/images/')} loading={eager?'eager':'lazy'} className={className} onError={()=>setBroken(true)}/>;
}
function ProductCard({product,quantity,money,change,onDetail}) {
  return <article className="product-card" data-product={product.id}>
    <Button unstyled className="product-image-button" onClick={()=>onDetail(product)} aria-label={`Ver ${product.nombre}`}><Photo product={product}/>{quantity>0&&<span className="quantity-badge">{quantity}</span>}</Button>
    <p className="product-category">{product.categoria}</p>
    <Button unstyled className="product-name" onClick={()=>onDetail(product)}>{product.nombre}</Button>
    <p className="product-pack">{product.disponibilidad==='agotado'?'Agotado':pack(product)}</p>
    <div className="price-row"><IconButton unstyled className="add-button subtract-button" aria-label={`Quitar una presentación de ${product.nombre}`} disabled={!quantity} onClick={()=>change(product,-1)}>−</IconButton><span className="price">{money(product.precio)}</span><IconButton unstyled className="add-button" aria-label={`Agregar ${product.nombre}`} disabled={product.disponibilidad==='agotado'} onClick={()=>change(product,1)}>+</IconButton></div>
  </article>;
}
const Modal=lazy(()=>import('./store-modal'));
export default function Store({initialCatalog=null}) {
  const [products,setProducts]=useState(()=>initialCatalog?.products||[]), [settings,setSettings]=useState(()=>initialCatalog?.settings||{currency:'ARS',checkoutEnabled:false,name:'Vitalia'});
  const [status,setStatus]=useState(initialCatalog?'ready':'loading'),[category,setCategory]=useState('Todos'),[query,setQuery]=useState(''),[sort,setSort]=useState('catalog'),[limit,setLimit]=useState(24);
  const [detail,setDetail]=useState(null),[help,setHelp]=useState(false),[toast,setToast]=useState('');
  const [mounted,setMounted]=useState(false),{resolvedTheme,setTheme}=useTheme();
  const header=useRef(null),search=useRef(null);
  const {cart,count,total,loaded,addSelection,change:changeCart}=useCart(products,{catalogReady:status==='ready'});
  const loadCatalog=useCallback(async()=>{
    setStatus('loading');
    try {const response=await fetch('/api/catalog',{cache:'no-store'});if(!response.ok)throw Error();const data=await response.json();setProducts(data.products);setSettings(data.settings);setStatus('ready');return true;}
    catch {setStatus('error');setSettings(s=>({...s,checkoutEnabled:false}));return false;}
  },[]);
  useEffect(()=>{
    setMounted(true);
    if(!initialCatalog)loadCatalog();
    const observer=new ResizeObserver(()=>document.documentElement.style.setProperty('--header-height',`${header.current?.getBoundingClientRect().height||145}px`));observer.observe(header.current);
    const shortcut=event=>{if(event.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!document.querySelector('dialog[open],[role="dialog"]')){event.preventDefault();search.current?.focus();}};
    document.addEventListener('keydown',shortcut);return ()=>{observer.disconnect();document.removeEventListener('keydown',shortcut);};
  },[loadCatalog,initialCatalog]);
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),2300);return()=>clearTimeout(timer);},[toast]);
  useEffect(()=>{document.title=`${settings.name} · Dietética`;},[settings.name]);
  const formatter=useMemo(()=>new Intl.NumberFormat('es-AR',{style:'currency',currency:settings.currency,maximumFractionDigits:2}),[settings.currency]);
  const money=value=>formatter.format(value);
  const filtered=useMemo(()=>{const result=products.filter(p=>(category==='Todos'||p.categoria===category)&&(!query||normalize([p.nombre,p.descripcion,p.categoria,p.id,p.presentacion].join(' ')).includes(normalize(query))));if(sort==='price-asc')result.sort((a,b)=>a.precio-b.precio);if(sort==='price-desc')result.sort((a,b)=>b.precio-a.precio);if(sort==='name')result.sort((a,b)=>a.nombre.localeCompare(b.nombre,'es'));return result;},[products,category,query,sort]);
  const categories=['Todos',...new Set(products.map(p=>p.categoria))];
  function change(product,delta){const error=changeCart(product,delta);setToast(error||(delta>0?'Producto agregado a tu pedido':''));}
  return <>
    <a className="skip-link" href="#catalogo">Ir al catálogo</a>
    <div className="sticky-header" ref={header}><div className="topbar">VENTA MAYORISTA <span>·</span> Armá tu pedido y coordiná por WhatsApp</div>
      <header className="header"><a className="brand" href="/" aria-label="Vitalia, inicio"><Image className="brand-logo" src="/images/logo-web.webp" width={156} height={100} sizes="(max-width: 540px) 112px, 156px" alt="Vitalia · Dietética" loading="eager" fetchPriority="high"/></a>
      <form className="search" role="search" onSubmit={e=>{e.preventDefault();document.getElementById('catalogo').scrollIntoView();}}><Icon name="search"/><label className="sr-only" htmlFor="search">Buscar productos</label><Input unstyled id="search" ref={search} type="search" placeholder="¿Qué estás buscando?" autoComplete="off" value={query} onChange={e=>{setQuery(e.target.value);setLimit(24);}}/><kbd>/</kbd></form>
      <div className="header-actions"><Button unstyled className="plain help-button" onClick={()=>setHelp(true)}>Cómo comprar</Button><IconButton unstyled id="theme-toggle" className="theme-toggle" aria-label={mounted&&resolvedTheme==='dark'?'Activar modo claro':'Activar modo oscuro'} aria-pressed={mounted&&resolvedTheme==='dark'} onClick={()=>setTheme(resolvedTheme==='dark'?'light':'dark')}><span className="theme-sun"><Icon name="sun"/></span><span className="theme-moon"><Icon name="moon"/></span></IconButton></div></header>
    </div>
    <main className="shell">{(settings.isPreview||settings.testCheckout)&&<div className="preview-note">{settings.checkoutEnabled?'Vista previa: los mensajes de WhatsApp se prepararán como pedidos de prueba.':'Vista previa del catálogo. Los pedidos todavía no están habilitados.'}</div>}
      <section className="hero" aria-labelledby="hero-title"><div className="hero-copy"><p className="eyebrow">EL ALMACÉN, A TU MANERA</p><h1 id="hero-title">Un buen pedido.<br/>Muchas cosas ricas.</h1><p>Elegí tus productos. Nosotros seguimos<br className="desktop-break"/> la conversación por WhatsApp.</p><a className="hero-link" href="#catalogo">Explorar el catálogo</a></div><div className="hero-photos" aria-hidden="true">{['023','002','037'].map((id,i)=><Image key={id} className={`hero-photo photo-${['one','two','three'][i]}`} src={`/images/product-${id}.webp`} width={240} height={250} alt="" sizes="(max-width: 760px) 180px, 240px" loading={i===0?'eager':'lazy'} fetchPriority={i===0?'high':'auto'}/>)}<span className="hero-stamp">PARA<br/>COMPARTIR<br/><b>Y DISFRUTAR</b></span></div></section>
      <BoxBuilder products={products} money={money} ready={status==='ready'&&loaded} onAdd={addSelection}/>
      <section className="catalog-section" id="catalogo" aria-labelledby="catalog-title"><div className="catalog-top"><div><p className="eyebrow muted">ENCONTRÁ TUS FAVORITOS</p><h2 id="catalog-title">Nuestro catálogo<span>.</span></h2></div></div>
        <div className="catalog-layout"><aside className="categories"><h3>Categorías</h3><nav aria-label="Categorías de productos">{categories.map(name=><Button unstyled key={name} className="category-button" aria-pressed={name===category} onClick={()=>{setCategory(name);setLimit(24);}}><span>{name}</span><span className="category-count">{name==='Todos'?products.length:products.filter(p=>p.categoria===name).length}</span></Button>)}</nav><div className="side-note"><span className="tiny-rule"/><strong>De tu carrito<br/>a WhatsApp.</strong><p>Consultá disponibilidad y coordiná el pago y la entrega al enviar tu pedido.</p></div></aside>
        <div className="results"><div className="results-toolbar"><p role="status" aria-live="polite">{status==='loading'?'Cargando productos…':status==='error'?'Catálogo no disponible':`${filtered.length} ${filtered.length===1?'producto':'productos'}${category==='Todos'?'':' · '+category}`}</p><label className="sort-label" htmlFor="sort">Ordenar <NativeSelect.Root className="chakra-sort" width={{base:'176px',sm:'188px'}}><NativeSelect.Field id="sort" value={sort} onChange={e=>{setSort(e.target.value);setLimit(24);}} bg="var(--surface)" color="var(--ink)" borderColor="var(--line)" paddingInlineStart="14px" paddingInlineEnd="44px" minHeight="44px"><option value="catalog">Según catálogo</option><option value="price-asc">Menor precio</option><option value="price-desc">Mayor precio</option><option value="name">Nombre: A a Z</option></NativeSelect.Field><NativeSelect.Indicator insetInlineEnd="14px" color="var(--ink)"/></NativeSelect.Root></label></div>
          {status==='error'?<div className="status-panel"><h3>No pudimos cargar el catálogo</h3><p>Intentá nuevamente en unos minutos.</p><Button unstyled onClick={loadCatalog}>Reintentar</Button></div>:status==='ready'&&!filtered.length?<div className="status-panel"><h3>No encontramos esos productos</h3><p>Probá con otra palabra o explorá todas las categorías.</p><Button unstyled onClick={()=>{setQuery('');setCategory('Todos');}}>Ver todo el catálogo</Button></div>:<div className="product-grid" aria-busy={status==='loading'}>{filtered.slice(0,limit).map(product=><ProductCard key={product.id} product={product} quantity={cart[product.id]||0} money={money} change={change} onDetail={setDetail}/>)}</div>}
          {filtered.length>limit&&<Button unstyled className="load-more" onClick={()=>setLimit(n=>n+24)}>Ver más productos ({Math.min(limit,filtered.length)} de {filtered.length})</Button>}
        </div></div>
      </section>
    </main>
    <footer className="footer"><a href="/" className="footer-brand">Vitalia</a><p>Elegí. Sumá. Conversemos.</p></footer>
    <Link href="/checkout" prefetch={false} id="floating-cart" className="floating-cart" aria-label={count?`Ir a mi pedido, ${count} presentaciones, total ${money(total)}`:'Ir a mi pedido, carrito vacío'}><Icon name="bag"/><span className="floating-cart-copy"><strong>Mi pedido <b>{count}</b></strong><span>{count?`${count} ${count===1?'presentación':'presentaciones'}`:'Carrito vacío'}</span></span><span className="floating-cart-total">{money(total)}</span></Link>
    <div className={`toast ${toast?'show':''}`} role="status" aria-live="polite">{toast}</div>
    {detail&&<Suspense fallback={null}><Modal open={!!detail} onClose={()=>setDetail(null)} title={detail?.nombre||'Detalle de producto'}>{detail&&<div className="product-detail-layout"><Photo product={detail} className="detail-image" context="detail" eager/><div className="detail-content"><p className="eyebrow muted">{detail.categoria}</p><h2>{detail.nombre}</h2><p className="detail-meta">{detail.id} · {pack(detail)}</p>{detail.descripcion&&<p className="detail-description">{detail.descripcion}</p>}<p className="detail-price">{money(detail.precio)}</p><p className="detail-meta">Precio por la presentación indicada. Moneda: {settings.currency}.</p><p className="detail-stock">{detail.disponibilidad==='disponible'?'Disponible según catálogo':detail.disponibilidad==='agotado'?'Agotado':'Disponibilidad a confirmar por WhatsApp'}</p><Button unstyled className="primary" disabled={detail.disponibilidad==='agotado'} onClick={()=>{change(detail,1);setDetail(null);}}>Agregar al pedido</Button></div></div>}</Modal></Suspense>}
    {help&&<Suspense fallback={null}><Modal open={help} onClose={()=>setHelp(false)} title="Tu pedido, paso a paso" help><p className="eyebrow muted">ASÍ DE SIMPLE</p><h2>Tu pedido, paso a paso.</h2><ol><li><strong>Elegí tus productos.</strong><p>Revisá la presentación de cada uno y sumalo al carrito. Una cantidad equivale a una presentación, no siempre a una unidad individual.</p></li><li><strong>Prepará el mensaje.</strong><p>Completá tu nombre, localidad y provincia. Podés agregar una consulta opcional.</p></li><li><strong>Seguimos por WhatsApp.</strong><p>Enviá el mensaje para confirmar disponibilidad, presentaciones, entrega y forma de pago. El sitio no cobra ni reserva stock.</p></li></ol></Modal></Suspense>}
  </>;
}
