// Productos destacados de la página 404: los primeros 4 del catálogo con precio, foto y sin agotar.
// Determinístico (orden del Sheet) para que la página no cambie entre visitas.
export function notFoundFeatured(products,limit=4){
  return (products||[]).filter(p=>p?.id&&p.precio>0&&p.imagen&&p.disponibilidad!=='agotado').slice(0,limit);
}
