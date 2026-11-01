// Slugs y URLs de las páginas de producto y categoría (Fase 1). Sin dependencias de servidor:
// lo usan tanto las páginas como las tarjetas del cliente.
import {claimFreeName} from './claims.js';

// Minúsculas, sin acentos y todo lo que no sea [a-z0-9] pasa a "-".
export function slugify(value){
  return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
}
// El slug va sin claims pendientes ("sin T.A.C.C", "sin gluten"…), igual que el title y el JSON-LD.
export const productSlug=product=>`${slugify(claimFreeName(product.nombre))}-${String(product.id).toLowerCase()}`;
// Todo producto activo con ID tiene página (los aceites de CBD N296/N297 incluidos, decisión de la tienda, 28/10).
export const hasProductPage=product=>Boolean(product?.id);
// null cuando el producto no tiene página: la tarjeta vuelve al modal o queda sin link.
export const productPath=product=>hasProductPage(product)?`/productos/${productSlug(product)}`:null;
export const categoryPath=name=>`/categorias/${slugify(name)}`;
// El ID va al final del slug ("granola-tradicional-n037") porque hay nombres repetidos.
// Se resuelve por ese sufijo; si hay dos candidatos, gana el ID más largo.
export function findBySlug(products,slug){
  const value=String(slug||'').toLowerCase();
  return (products||[]).filter(p=>value.endsWith(`-${String(p.id).toLowerCase()}`)).sort((a,b)=>b.id.length-a.id.length)[0]||null;
}
