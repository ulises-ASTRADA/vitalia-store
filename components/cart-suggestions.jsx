'use client';
import { Button } from '@chakra-ui/react';
import {useState} from 'react';
import NextImage from 'next/image';
import {offerPrice} from '../lib/cart-offers';
const Image=NextImage.default||NextImage;
function SuggestionPhoto({product}) {
  const [broken,setBroken]=useState(false);
  const src=broken?'/images/logo-web.webp':product.imagen||'/images/logo-web.webp';
  return <Image className="suggestion-photo" src={src} alt={product.nombre} width={72} height={72} sizes="72px" loading="lazy" unoptimized={!src.startsWith('/images/')} onError={()=>setBroken(true)}/>;
}
export default function CartSuggestions({recommendations,money,busy,onAdd}) {
  if (!recommendations.length) return null;
  return <section className="cart-suggestions" aria-labelledby="suggestions-title">
    <h3 id="suggestions-title">Descuentos para vos por tu compra</h3>
    {recommendations.length > 0 && <><div className="suggestion-list">{recommendations.map(product=><article className="suggestion" key={product.id}>
      <div className="suggestion-product"><SuggestionPhoto key={product.imagen} product={product}/><div><h4>{product.nombre}</h4><p>{product.presentacion || 'Presentación a confirmar'}</p><p className="offer-prices"><del aria-label="Precio original">{money(product.precio)}</del><strong>{money(offerPrice(product.precio))}</strong></p><p className="offer-saving">10% de descuento · Ahorrás {money((Math.round(product.precio*100)-Math.round(offerPrice(product.precio)*100))/100)}</p></div></div>
      <Button unstyled type="button" className="secondary" disabled={busy} aria-label={`Agregar sugerencia: ${product.nombre}`} onClick={()=>onAdd(product)}>Agregar</Button>
    </article>)}</div></>}
    <p className="suggestion-note">10% en la primera presentación sugerida mientras conserves el producto que la acompaña. Disponibilidad a consultar. Solo se agregan si vos elegís.</p>
  </section>;
}
