'use client';
import { Button } from '@chakra-ui/react';
import {offerPrice} from '../lib/cart-offers';
export default function CartSuggestions({recommendations,money,busy,onAdd}) {
  if (!recommendations.length) return null;
  return <section className="cart-suggestions" aria-labelledby="suggestions-title">
    <h3 id="suggestions-title">Completá tu pedido</h3>
    {recommendations.length > 0 && <><p>Podés acompañarlo con…</p><div className="suggestion-list">{recommendations.map(product=><article className="suggestion" key={product.id}>
      <div><h4>{product.nombre}</h4><p>{product.presentacion || 'Presentación a confirmar'}</p><p className="offer-prices"><del aria-label="Precio original">{money(product.precio)}</del><strong>{money(offerPrice(product.precio))}</strong></p><p className="offer-saving">10% de descuento · Ahorrás {money((Math.round(product.precio*100)-Math.round(offerPrice(product.precio)*100))/100)}</p></div>
      <Button unstyled type="button" className="secondary" disabled={busy} aria-label={`Agregar sugerencia: ${product.nombre}`} onClick={()=>onAdd(product)}>Agregar</Button>
    </article>)}</div></>}
    <p className="suggestion-note">10% en la primera presentación sugerida mientras conserves el producto que la acompaña. Disponibilidad a consultar. Solo se agregan si vos elegís.</p>
  </section>;
}
