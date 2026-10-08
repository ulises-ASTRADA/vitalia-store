// Editá estas relaciones para elegir categorías complementarias.
// No implica stock confirmado, descuentos ni variantes equivalentes.
export const complementaryCategories = {
  'Galletitas y panificados': ['Infusiones', 'Untables y dulces'],
  'Infusiones': ['Galletitas y panificados', 'Alfajores y chocolates'],
  'Granolas y cereales': ['Frutos secos y semillas', 'Untables y dulces'],
  'Frutos secos y semillas': ['Granolas y cereales', 'Barritas'],
  'Barritas': ['Frutos secos y semillas', 'Snacks'],
  'Harinas, pastas y legumbres': ['Especias y condimentos', 'Aceites y conservas'],
  'Aceites y conservas': ['Harinas, pastas y legumbres', 'Especias y condimentos'],
  'Especias y condimentos': ['Harinas, pastas y legumbres', 'Aceites y conservas'],
  'Snacks': ['Frutos secos y semillas', 'Infusiones'],
  'Untables y dulces': ['Galletitas y panificados', 'Infusiones'],
  'Alfajores y chocolates': ['Infusiones', 'Galletitas y panificados'],
  'Suplementos': ['Barritas', 'Frutos secos y semillas'],
  'Almacén': ['Infusiones', 'Galletitas y panificados']
};
export function getRecommendations(products, items) {
  if (!items.length || items.length >= 50) return [];
  const inCart = new Set(items.map(({product}) => product.id));
  const categories = [...new Set(items.flatMap(({product}) => complementaryCategories[product.categoria] || []))];
  // Una sugerencia por categoría; orden estable del catálogo, sin popularidad inventada.
  return categories.map(category => products.find(product => product.categoria === category && !inCart.has(product.id) && product.activo !== false && product.disponibilidad !== 'agotado' && Number.isFinite(product.precio) && product.precio > 0)).filter(Boolean).slice(0, 3);
}
export function getQuantitySuggestion(items) {
  // Cantidad adicional del mismo SKU, nunca una presentación mayor inventada.
  return items.find(({product,quantity}) => quantity < 99 && product.disponibilidad !== 'agotado' && product.precio > 0) || null;
}
