// Vista previa al compartir un link (WhatsApp, Instagram, X, Facebook).
// URLs absolutas: algunos lectores de og:image no resuelven rutas relativas.
export const SITE_URL='https://www.vitalia.energy';
export const OG_HOME_IMAGE={url:`${SITE_URL}/og/og-home.png`,width:1200,height:630,type:'image/png',alt:'Vitalia: alimentos naturales a domicilio en Villa Allende'};
import {claimFreeName} from './claims.js';
import {OG_PRODUCT_IMAGES} from './og-products.js';
const absolute=path=>new URL(path,SITE_URL).href;

// Foto del producto en su versión para compartir (JPG <300 KB, con ancho y alto); la ficha sigue usando el webp.
// Sin versión para compartir, la imagen general de la tienda. El alt va sin claims pendientes.
export function productShareImage(product){
  const src=product?.imagen||'';const alt=claimFreeName(product?.nombre||'');
  const share=Object.hasOwn(OG_PRODUCT_IMAGES,src)?OG_PRODUCT_IMAGES[src]:null;
  if(share)return {url:absolute(share.url),width:share.width,height:share.height,type:'image/jpeg',alt};
  if(src.startsWith('/images/'))return OG_HOME_IMAGE;
  if(/^https:\/\//.test(src))return {url:src,alt};
  return OG_HOME_IMAGE;
}

export function shareMetadata({path,title,description,image=OG_HOME_IMAGE}){
  const desc=description?{description}:{};
  return {
    openGraph:{type:'website',url:absolute(path),siteName:'Vitalia',locale:'es_AR',title,...desc,images:[image]},
    twitter:{card:'summary_large_image',title,...desc,images:[{url:image.url,alt:image.alt}]}
  };
}
