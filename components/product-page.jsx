'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import NextLink from 'next/link';
import {Button} from '@chakra-ui/react';
import SiteHeader from './site-header';
import SiteFooter from './site-footer';
import Icon from './icon';
import FloatingCart from './floating-cart';
import ShipLine from './ship-line';
import {ProductCard,Photo} from './product-card';
import {useCart} from './use-cart';
import {productPath} from '../lib/product-links';
const Link=NextLink.default||NextLink;
const STOCK={disponible:'Disponible según catálogo',agotado:'Agotado',consultar:'Disponibilidad a confirmar por WhatsApp'};

export default function ProductPage({catalog,product,page,related,category,storeWhatsappUrl}) {
  const {products,settings}=catalog;
  const {cart,loaded,count,total,change}=useCart(products);
  const formatter=useMemo(()=>new Intl.NumberFormat('es-AR',{style:'currency',currency:settings.currency,maximumFractionDigits:2}),[settings.currency]);
  const money=value=>formatter.format(value);
  const [feedback,setFeedback]=useState(''),[toast,setToast]=useState('');
  const goToCart=useRef(null),focusCart=useRef(false);
  const quantity=loaded?cart[product.id]||0:0;
  const out=product.disponibilidad==='agotado',priced=product.precio>0;
  useEffect(()=>{if(quantity>0&&focusCart.current){focusCart.current=false;goToCart.current?.focus();}},[quantity]);
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),2300);return()=>clearTimeout(timer);},[toast]);
  function update(delta){
    const error=change(product,delta);
    if(error){setFeedback(error);return;}
    const next=Math.max(0,quantity+delta);
    if(delta>0&&quantity===0)focusCart.current=true;
    setFeedback(next===0?'Quitaste el producto de tu pedido.':next===1&&delta>0?'Sumaste 1 a tu pedido.':`Tenés ${next} en tu pedido.`);
  }
  function changeRelated(item,delta){const error=change(item,delta);setToast(error||(delta>0?'Producto agregado a tu pedido':''));}
  const consult=page.whatsappUrl;
  return <>
    <a className="skip-link" href="#contenido">Ir al contenido</a>
    <SiteHeader current="catalog"/>
    <main className="shell product-page" id="contenido">
      <nav className="breadcrumb" aria-label="Ruta de navegación"><ol><li><Link href="/">Inicio</Link></li><li><Link href={category.href}>{product.categoria}</Link></li><li><span aria-current="page">{product.nombre}</span></li></ol></nav>
      <article className="pdp" data-product={product.id}>
        <div className="pdp-media"><Photo product={product} context="page" eager/></div>
        <div className="pdp-info">
          <p className="eyebrow muted"><Link href={category.href}>{product.categoria.toLocaleUpperCase('es-AR')}</Link></p>
          <h1 className={`pdp-title${product.nombre.length>60?' is-long':''}`}>{product.nombre}</h1>
          <p className="pdp-price">{priced?<span className="pdp-amount">{money(product.precio)}</span>:<span className="pdp-amount price-ask">Precio a consultar</span>}<span className="pdp-unit">{page.pack?`por ${page.pack}`:'por presentación (a confirmar)'}</span></p>
          {priced&&page.perKilo&&<p className="pdp-perkg">Equivale a {money(page.perKilo)} el kilo.</p>}
          <div className="pdp-buy">{out||!priced
            ?consult?<a className="primary" href={consult} rel="noopener"><Icon name="chat"/>Consultar por WhatsApp</a>:<Button unstyled className="primary" disabled><Icon name="bag"/>{out?'Agotado':'Precio a consultar'}</Button>
            :quantity>0
              ?<><div className="pdp-stepper" role="group" aria-label="Cantidad"><Button unstyled aria-label="Quitar una presentación" onClick={()=>update(-1)}>−</Button><output aria-live="off">{quantity}</output><Button unstyled aria-label="Sumar una presentación" onClick={()=>update(1)}>+</Button></div><Link ref={goToCart} className="primary" href="/checkout" prefetch={false}><Icon name="bag"/>Ir a mi pedido</Link></>
              :<Button unstyled className="primary" onClick={()=>update(1)}><Icon name="bag"/>Agregar al pedido</Button>}
          </div>
          <p className="pdp-feedback" role="status">{out?'Está agotado por ahora. Escribinos y te contamos cuándo vuelve.':!priced?'Todavía no tenemos el precio cargado. Escribinos y te lo pasamos.':feedback}</p>
          {!out&&priced&&consult&&<a className="pdp-secondary" href={consult} rel="noopener"><Icon name="chat"/>Consultar por WhatsApp</a>}
          <ShipLine/>
          <p className={`detail-stock${out?' is-out':''}`}>{STOCK[product.disponibilidad]||STOCK.consultar}</p>
          {page.description&&<><h2 className="pdp-section-title">Descripción</h2><p className="detail-description">{page.description}</p></>}
          <p className="detail-meta">Código {product.id} · Presentación: {page.pack||'a confirmar'}</p>
        </div>
      </article>
      {related.length>0&&<section className="related" aria-labelledby="related-title"><div className="related-head"><h2 id="related-title">Más de {product.categoria}</h2></div>
        <div className="product-grid">{related.map(item=><ProductCard key={item.id} product={item} quantity={loaded?cart[item.id]||0:0} money={money} change={changeRelated} href={productPath(item)}/>)}</div>
        <Link className="load-more" href={category.href}>Ver todo {product.categoria} ({category.count})</Link></section>}
    </main>
    <SiteFooter whatsappUrl={storeWhatsappUrl}/>
    <FloatingCart count={count} total={total} money={money}/>
    <div className={`toast ${toast?'show':''}`} role="status" aria-live="polite">{toast}</div>
  </>;
}
