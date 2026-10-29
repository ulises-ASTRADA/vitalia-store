'use client';
import {useEffect,useRef,useState} from 'react';
import NextImage from 'next/image';
import NextLink from 'next/link';
import {Button,IconButton} from '@chakra-ui/react';
const Image=NextImage.default||NextImage,Link=NextLink.default||NextLink;
export const pack=product=>product.presentacion||'Presentación a confirmar';
const FALLBACK='/images/logo-web.webp';

// Foto con ratio reservado: skeleton mientras carga y logo con "Foto no disponible" si falla.
export function Photo({product,className='',eager=false,context='card',frame=true}) {
  const [broken,setBroken]=useState(false),[loading,setLoading]=useState(false);
  const image=useRef(null);
  const src=broken?FALLBACK:product.imagen||FALLBACK;
  const fallback=src===FALLBACK;
  useEffect(()=>{const img=image.current;if(img&&!img.complete)setLoading(true);else if(img&&img.naturalWidth===0&&!broken)setBroken(true);},[src,broken]);
  const sizes=context==='detail'?'(max-width: 760px) calc(100vw - 88px), 400px':context==='page'?'(max-width: 540px) calc(100vw - 32px), (max-width: 850px) 45vw, 540px':context==='cart'?'64px':'(max-width: 540px) calc((100vw - 48px)/2), (max-width: 1050px) 30vw, 260px';
  const big=context==='detail'||context==='page';
  const img=<Image ref={image} src={src} alt={product.nombre} width={big?800:360} height={big?780:350} sizes={sizes} unoptimized={!src.startsWith('/images/')} loading={eager?'eager':'lazy'} fetchPriority={eager&&context==='page'?'high':undefined} className={className} onLoad={()=>setLoading(false)} onError={()=>{setLoading(false);setBroken(true);}}/>;
  if(!frame)return img;
  return <div className={`media-frame${loading?' is-loading':''}${fallback?' is-fallback':''}`}>{img}{fallback&&<span className="no-photo" aria-hidden="true">Foto no disponible</span>}</div>;
}

// Tarjeta del catálogo. Con href, la foto y el nombre llevan a /productos/[slug].
// Sin href (productos sin página), abren el modal si hay onDetail, o quedan sin link.
export function ProductCard({product,quantity,money,change,href,onDetail}) {
  const out=product.disponibilidad==='agotado',priced=product.precio>0;
  const media=<><Photo product={product}/>{out&&<span className="out-badge">Agotado</span>}{quantity>0&&<span className="quantity-badge">{quantity}</span>}</>;
  return <article className={`product-card${out?' is-out':''}`} data-product={product.id}>
    {href?<Link className="product-image-button" href={href} aria-label={`Ver ${product.nombre}`} tabIndex={-1}>{media}</Link>
      :onDetail?<Button unstyled className="product-image-button" onClick={()=>onDetail(product)} aria-label={`Ver ${product.nombre}`}>{media}</Button>
      :<div className="product-image-button">{media}</div>}
    <p className="product-category">{product.categoria}</p>
    {href?<Link className="product-name" href={href}>{product.nombre}</Link>
      :onDetail?<Button unstyled className="product-name" onClick={()=>onDetail(product)}>{product.nombre}</Button>
      :<p className="product-name">{product.nombre}</p>}
    <p className={`product-pack${out?' is-out':''}`}>{out?'Agotado':pack(product)}</p>
    <div className="price-row"><IconButton unstyled className="add-button subtract-button" aria-label={`Quitar una presentación de ${product.nombre}`} disabled={!quantity} onClick={()=>change(product,-1)}>−</IconButton>{priced?<span className="price">{money(product.precio)}</span>:<span className="price price-ask">Precio a consultar</span>}<IconButton unstyled className="add-button" aria-label={`Agregar ${product.nombre}`} disabled={out||!priced} onClick={()=>change(product,1)}>+</IconButton></div>
  </article>;
}
