'use client';
import {useEffect,useRef,useState} from 'react';
import NextImage from 'next/image';
import NextLink from 'next/link';
import {Button} from '@chakra-ui/react';
const Image=NextImage.default||NextImage,Link=NextLink.default||NextLink;
export const pack=product=>product.presentacion||'Presentación a confirmar';
const FALLBACK='/images/logo-web.webp';
// Tope por producto que ya aplica el carrito (use-cart.js y lib/checkout.js). No hay stock por producto en los datos.
export const CARD_MAX_QUANTITY=99;

// Foto con ratio reservado: skeleton mientras carga y logo con "Foto no disponible" si falla.
export function Photo({product,className='',eager=false,context='card',frame=true,alt}) {
  const [broken,setBroken]=useState(false),[loading,setLoading]=useState(false);
  const image=useRef(null);
  const src=broken?FALLBACK:product.imagen||FALLBACK;
  const fallback=src===FALLBACK;
  useEffect(()=>{const img=image.current;if(img&&!img.complete)setLoading(true);else if(img&&img.naturalWidth===0&&!broken)setBroken(true);},[src,broken]);
  const sizes=context==='detail'?'(max-width: 760px) calc(100vw - 88px), 400px':context==='page'?'(max-width: 540px) calc(100vw - 32px), (max-width: 850px) 45vw, 540px':context==='cart'?'64px':'(max-width: 540px) calc((100vw - 48px)/2), (max-width: 1050px) 30vw, 260px';
  const big=context==='detail'||context==='page';
  const img=<Image ref={image} src={src} alt={alt??product.nombre} width={big?800:360} height={big?780:350} sizes={sizes} unoptimized={!src.startsWith('/images/')} loading={eager?'eager':'lazy'} fetchPriority={eager&&context==='page'?'high':undefined} className={className} onLoad={()=>setLoading(false)} onError={()=>{setLoading(false);setBroken(true);}}/>;
  if(!frame)return img;
  return <div className={`media-frame${loading?' is-loading':''}${fallback?' is-fallback':''}`}>{img}{fallback&&<span className="no-photo" aria-hidden="true">Foto no disponible</span>}</div>;
}

// Contador de la tarjeta: con 0 es un botón "Agregar" a lo ancho; con 1 o más, [ − | n | + ].
// El número es una región aria-live que sobrevive al cambio de estado (misma key), y el foco pasa
// a "+" al agregar el primero y vuelve a "Agregar" al quitar el último.
function CardQuantity({product,quantity,change,disabled}) {
  const plus=useRef(null),add=useRef(null),pending=useRef(null);
  useEffect(()=>{
    if(pending.current==='plus'&&quantity>0)plus.current?.focus();
    if(pending.current==='add'&&!quantity)add.current?.focus();
    pending.current=null;
  },[quantity]);
  const name=product.nombre,full=quantity>=CARD_MAX_QUANTITY;
  return <div className={`card-qty${quantity>0?' is-active':''}`} role="group" aria-label={`Cantidad de ${name}`}>
    {quantity>0&&<Button unstyled key="minus" type="button" className="card-qty-minus" aria-label={`Quitar una presentación de ${name}`} onClick={()=>{if(quantity===1)pending.current='add';change(product,-1);}}><span aria-hidden="true">−</span></Button>}
    <span key="count" className={quantity>0?'card-qty-count':'sr-only'} aria-live="polite" aria-atomic="true">{quantity>0?<><span className="sr-only">En tu pedido: </span>{quantity}</>:''}</span>
    {quantity>0
      ?<Button unstyled key="plus" ref={plus} type="button" className="card-qty-plus" aria-label={`Agregar una presentación de ${name}`} disabled={full} title={full?`Máximo de ${CARD_MAX_QUANTITY} presentaciones por producto`:undefined} onClick={()=>change(product,1)}><span aria-hidden="true">+</span></Button>
      :<Button unstyled key="add" ref={add} type="button" className="card-qty-add" aria-label={`Agregar ${name}`} disabled={disabled} onClick={()=>{pending.current='plus';change(product,1);}}>Agregar</Button>}
  </div>;
}

// Tarjeta del catálogo. Con href, la foto y el nombre llevan a /productos/[slug].
// Sin href (productos sin página), abren el modal si hay onDetail, o quedan sin link.
export function ProductCard({product,quantity,money,change,href,onDetail}) {
  const out=product.disponibilidad==='agotado',priced=product.precio>0;
  const media=<><Photo product={product}/>{out&&<span className="out-badge">Agotado</span>}</>;
  return <article className={`product-card${out?' is-out':''}`} data-product={product.id}>
    {href?<Link className="product-image-button" href={href} aria-label={`Ver ${product.nombre}`} tabIndex={-1}>{media}</Link>
      :onDetail?<Button unstyled className="product-image-button" onClick={()=>onDetail(product)} aria-label={`Ver ${product.nombre}`}>{media}</Button>
      :<div className="product-image-button">{media}</div>}
    <p className="product-category">{product.categoria}</p>
    {href?<Link className="product-name" href={href}>{product.nombre}</Link>
      :onDetail?<Button unstyled className="product-name" onClick={()=>onDetail(product)}>{product.nombre}</Button>
      :<p className="product-name">{product.nombre}</p>}
    <p className={`product-pack${out?' is-out':''}`}>{out?'Agotado':pack(product)}{!out&&<><span className="product-pack-sep" aria-hidden="true"> · </span><span className="sr-only">, </span>{priced?<b className="price">{money(product.precio)}</b>:<span className="price price-ask">Precio a consultar</span>}</>}</p>
    <CardQuantity product={product} quantity={quantity} change={change} disabled={out||!priced}/>
  </article>;
}
