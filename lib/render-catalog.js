import { unstable_cache } from 'next/cache';
import { getCatalog, publicSettings } from './catalog.js';

// La caché persistente de Next sustituye al caché en memoria para el render.
// Dentro siempre se consulta la fuente fresca. El checkout no usa esta función.
const readForRender = unstable_cache(
  async (_sourceKey) => getCatalog({fresh:true}),
  ['vitalia-render-catalog-v1'],
  {revalidate:60}
);
export async function getInitialCatalog() {
  const settings = publicSettings();
  const sourceKey = JSON.stringify([
    process.env.GOOGLE_SHEETS_ID || '', process.env.GOOGLE_SHEETS_TAB || 'Productos',
    process.env.GOOGLE_SHEETS_RANGE || 'Productos!A1:L5000',
    process.env.GOOGLE_SHEETS_PUBLIC === 'true', settings.isPreview
  ]);
  return {...await readForRender(sourceKey),settings};
}
