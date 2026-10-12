import { unstable_cache } from 'next/cache.js';
import { getCatalog, publicSettings } from './catalog.js';

// Caché compartida por render, catálogo público y checkout; vence en 60 segundos.
const readForRender = unstable_cache(
  async (_sourceKey) => getCatalog({fresh:true}),
  ['vitalia-render-catalog-v1'],
  {revalidate:60}
);
export async function getCachedCatalog() {
  const settings = publicSettings();
  const sourceKey = JSON.stringify([
    process.env.GOOGLE_SHEETS_ID || '', process.env.GOOGLE_SHEETS_TAB || 'Productos',
    process.env.GOOGLE_SHEETS_RANGE || 'Productos!A1:L5000',
    process.env.GOOGLE_SHEETS_PUBLIC === 'true', settings.isPreview
  ]);
  return await readForRender(sourceKey);
}
export async function getInitialCatalog() {return {...await getCachedCatalog(),settings:publicSettings()};}
