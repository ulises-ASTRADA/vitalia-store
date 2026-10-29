import {getCachedCatalog} from '../lib/render-catalog';
import {SITE_URL} from '../lib/seo';
import {categoryPath,productPath} from '../lib/product-links';
import {categoryList,pageProducts} from '../lib/product-pages';
export const revalidate=60;

// Home, boxes, envíos, categorías con productos y todos los productos activos.
export default async function sitemap() {
  const pages=['','/boxes','/envios'];
  try {
    const {products}=await getCachedCatalog();
    pages.push(...categoryList(products).map(c=>categoryPath(c.name)),...pageProducts(products).map(productPath));
  } catch {}
  return pages.map(path=>({url:`${SITE_URL}${path}`}));
}
