// Búsqueda del catálogo, compartida por la home (resultados + sugerencias) y el buscador del
// header en el resto de las páginas. Sin dependencias de servidor ni de React.

// Minúsculas y sin acentos: "Té" y "te" coinciden.
export const normalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

// Relevancia de un producto para el término (menor = mejor); null si no coincide.
// 0: el nombre empieza con el término · 1: el nombre lo contiene · 2: categoría o presentación · 3: descripción o ID.
function score(product,term){
  const name=normalize(product.nombre);
  if(name.startsWith(term))return 0;
  if(name.includes(term))return 1;
  if(normalize([product.categoria,product.presentacion].join(' ')).includes(term))return 2;
  if(normalize([product.descripcion,product.id].join(' ')).includes(term))return 3;
  return null;
}

export function matchesQuery(product,query){
  const term=normalize(String(query??'').trim());
  return !term||score(product,term)!==null;
}

// Única función de búsqueda y orden: la usan la grilla de la home (orden "Según catálogo") y el
// desplegable de sugerencias de todas las páginas, así la primera sugerencia es el primer resultado.
// Empata por orden del catálogo.
export function rankProducts(products,query,{category='Todos'}={}){
  const term=normalize(String(query??'').trim());
  const list=(products||[]).filter(product=>category==='Todos'||product.categoria===category);
  if(!term)return list;
  return list.map((product,index)=>({product,index,rank:score(product,term)}))
    .filter(item=>item.rank!==null)
    .sort((a,b)=>a.rank-b.rank||a.index-b.index)
    .map(item=>item.product);
}

// Sugerencias del desplegable: los mismos resultados en el mismo orden, sin el producto cuyo nombre
// ya está escrito completo.
export function searchSuggestions(products,query,options){
  const term=normalize(String(query??'').trim());
  if(!term)return [];
  return rankProducts(products,query,options).filter(product=>normalize(product.nombre)!==term);
}

// URL de los resultados en la home. Sin término vuelve al catálogo completo.
export const searchResultsPath=query=>{
  const term=String(query??'').trim();
  return term?`/?q=${encodeURIComponent(term)}`:'/';
};
