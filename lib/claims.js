// Claims pendientes de certificación ("Sin T.A.C.C.", "sin gluten", "sin azúcar"…). Sin dependencias
// de servidor: lo usan las páginas (title, og/twitter, meta, JSON-LD) y el slug de las tarjetas.
// Quedan fuera de title, og:title, twitter:title, slug, meta description y JSON-LD
// hasta que la tienda confirme la certificación (28/10). El nombre y la descripción visibles no cambian.
// Para revertir: FILTER_PENDING_CLAIMS=false.
export const FILTER_PENDING_CLAIMS=true;
export const PENDING_CLAIMS=[
  /\bsin\s+t\.?\s*a\.?\s*c\.?\s*c\.?/gi,
  /\b(?:libre\s+de|sin)\s+gluten\b/gi,
  /\bgluten[\s-]*free\b/gi,
  /\bapto\s+(?:para\s+)?cel[ií]ac[oa]s?\b/gi,
  /\bsin\s+az[uú]car(?:es)?(?:\s+agregad[ao]s?)?\b/gi,
  /\bsugar[\s-]*free\b/gi,
  /\bsin\s+harinas\s+refinadas(?:\s+ni\s+az[uú]car)?/gi
];
export function stripPendingClaims(text){
  if(!FILTER_PENDING_CLAIMS)return String(text||'');
  let out=String(text||'');
  // Primero "sin gluten y sin lácteos" → "sin lácteos"; después el claim suelto.
  for(const re of PENDING_CLAIMS)out=out.replace(new RegExp(`${re.source}(?:\\s*,\\s*|\\s+y\\s+|\\s+)(?=sin\\b)`,'gi'),'').replace(re,'');
  return out.replace(/\(\s*\)/g,'').replace(/\.(?:\s*\.)+/g,'.').replace(/\s+([,.;:])/g,'$1').replace(/(^|[.;:]\s*)[,;:]\s*/g,'$1').replace(/([,;:]\s*)+([.]|$)/g,'$2').replace(/\s{2,}/g,' ').replace(/^[\s,;:.]+/,'').trim();
}
// Nombre para Google: sin claims y sin puntuación colgando. Si no queda nada, el nombre original.
export function claimFreeName(name){
  return stripPendingClaims(name).replace(/\s*[—–-]\s*$/,'').replace(/[\s.,;:]+$/,'')||String(name||'');
}
