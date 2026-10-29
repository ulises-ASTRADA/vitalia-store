// Vista previa al compartir un link (WhatsApp, Instagram, X, Facebook).
// URLs absolutas: algunos lectores de og:image no resuelven rutas relativas.
export const SITE_URL='https://www.vitalia.energy';
export const OG_HOME_IMAGE={url:`${SITE_URL}/og/og-home.png`,width:1200,height:630,type:'image/png',alt:'Vitalia: alimentos naturales a domicilio en Villa Allende'};
import {claimFreeName} from './claims.js';
const absolute=path=>new URL(path,SITE_URL).href;

// Foto del producto si existe; si no, la imagen general de la tienda. El alt va sin claims pendientes.
export function productShareImage(product){
  const src=product?.imagen||'';const alt=claimFreeName(product?.nombre||'');
  if(src.startsWith('/images/'))return {url:absolute(src),...(src.endsWith('.webp')?{type:'image/webp'}:{}),alt};
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
