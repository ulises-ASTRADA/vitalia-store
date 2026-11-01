import NotFoundPage from '../components/not-found-page';
import {getInitialCatalog} from '../lib/render-catalog';
import {storeSettings} from '../lib/catalog';
import {whatsappUrl} from '../lib/seo';
import {notFoundFeatured} from '../lib/not-found';
export const runtime='nodejs';
// Next responde 404 y agrega <meta name="robots" content="noindex"> solo; no se repite acá para no duplicar la etiqueta.
export const metadata={title:{absolute:'Página no encontrada · Vitalia'}};
export default async function NotFound() {
  // Si el catálogo no carga, la 404 sale igual: sin destacados y el buscador lo pide a /api/catalog.
  let catalog=null;
  try{catalog=await getInitialCatalog();}catch{}
  return <NotFoundPage catalog={catalog} featured={notFoundFeatured(catalog?.products)} storeWhatsappUrl={whatsappUrl(storeSettings().phone)}/>;
}
