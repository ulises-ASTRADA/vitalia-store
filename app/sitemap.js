import {getCachedCatalog} from '../lib/render-catalog';
import {SITE_URL} from '../lib/seo';
import {categoryPath,productPath} from '../lib/product-links';
import {categoryList,pageProducts} from '../lib/product-pages';
export const revalidate=60;

// Home, boxes, categorías con productos y productos con página propia (sin la lista de exclusión).
export default async function sitemap() {
  const pages=['','/boxes'];
  try {
    const {products}=await getCachedCatalog();
    pages.push(...categoryList(products).map(c=>categoryPath(c.name)),...pageProducts(products).map(productPath));
  } catch {}
  return pages.map(path=>({url:`${SITE_URL}${path}`}));
}
