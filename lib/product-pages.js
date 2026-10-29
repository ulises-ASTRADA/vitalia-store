// Datos de las páginas de producto y categoría (Fase 1). Todo sale del catálogo en vivo
// y de data/categorias.json (intros escritas por diseño). No se inventa nada.
import categoryIntros from '../data/categorias.json' with {type:'json'};
import {SITE_URL} from './seo.js';
import {slugify,productSlug,hasProductPage,findBySlug} from './product-links.js';

export const PLACEHOLDERS=['[A COMPLETAR]','[A CONFIRMAR]'];
const INTROS=Object.fromEntries(Object.entries(categoryIntros).map(([name,value])=>[slugify(name),value.intro]));

// Hasta que exista /envios, la línea de envíos va sin link (no se enlaza a un 404).
export const ENVIOS_PAGE=false;
export const SHIP_ZONES_LINE='Envíos a tu zona: Villa Allende, Unquillo, Río Ceballos y 6 zonas más.';

export const money=(value,currency='ARS')=>new Intl.NumberFormat('es-AR',{style:'currency',currency,maximumFractionDigits:2}).format(value);
const NO_PACK=/^(consultar presentaci[oó]n)?$/i;
export const hasPack=product=>!NO_PACK.test(String(product.presentacion||'').trim());

// Precio por kilo solo cuando la presentación es un peso distinto de 1 kg.
export function kilos(presentacion){
  const match=/^(?:por\s+|x\s*)?(\d+(?:[.,]\d+)?)\s*(kg|kgs|kilo|kilos|g|gr|grs|gramos)\.?$/i.exec(String(presentacion||'').trim());
  if(!match)return null;
  const amount=Number(match[1].replace(',','.'));
  if(!(amount>0))return null;
  return /^k/i.test(match[2])?amount:amount/1000;
}
export function pricePerKilo(product){
  const kg=kilos(product.presentacion);
  if(!kg||kg===1||!(product.precio>0))return null;
  return Math.round(product.precio/kg*100)/100;
}

// Saca una primera línea que repite la presentación ("1 KG", "Por 5 KG", "14 unidades …").
export function cleanDescription(product){
  let text=String(product.descripcion||'').replace(/\s+/g,' ').trim();
  const pack=String(product.presentacion||'').trim();
  if(pack){
    const escaped=pack.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    text=text.replace(new RegExp(`^(?:por\\s+)?${escaped}\\.?(?:\\s+|$)`,'i'),'');
  }
  text=text.replace(/^por\s+\d+(?:[.,]\d+)?\s*kgs?\.?(?:\s+|$)/i,'');
  return text.trim();
}

// Precio para title/meta: sin centavos ni espacio ("$9.100").
export const metaMoney=(value,currency='ARS')=>currency==='ARS'
  ?`$${new Intl.NumberFormat('es-AR',{maximumFractionDigits:0}).format(Math.round(value))}`
  :new Intl.NumberFormat('es-AR',{style:'currency',currency,maximumFractionDigits:0}).format(value).replace(/\s/g,'');

// "Sin T.A.C.C.", "sin gluten", "sin azúcar"… quedan fuera de la meta description y del JSON-LD
// hasta que Ulises confirme la certificación (28/10). El nombre y la descripción visibles no cambian.
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
export const META_MAX=155,TITLE_MAX=60;
const normKey=text=>String(text||'').toLowerCase().replace(/\s+/g,' ').trim();

const absoluteImage=src=>src?.startsWith('/images/')?`${SITE_URL}${src}`:/^https:\/\//.test(src||'')?src:undefined;
const truncate=(text,max)=>{if(text.length<=max)return text;const cut=text.slice(0,max);return cut.slice(0,cut.lastIndexOf(' ')>max/2?cut.lastIndexOf(' '):max).replace(/[\s,;:.]+$/,'')+'…';};

export function whatsappConsultUrl(phone,product){
  if(!/^[1-9]\d{7,14}$/.test(phone||''))return '';
  const pack=hasPack(product)?product.presentacion:'presentación a confirmar';
  return `https://wa.me/${phone}?text=${encodeURIComponent(`¡Hola, Vitalia! Quiero consultar por ${product.nombre} (${pack}) · código ${product.id}.`)}`;
}

// ¿El producto tiene página? Todo producto activo del catálogo con ID.
export const pageProducts=products=>(products||[]).filter(hasProductPage);
export function resolveProduct(products,slug){
  const product=findBySlug(pageProducts(products),slug);
  return product?{product,canonicalSlug:productSlug(product)}:null;
}

// Hasta 4 de la misma categoría, sin agotados, sin el actual y ordenados por cercanía en el catálogo.
export function relatedProducts(products,product,limit=4){
  const index=products.findIndex(p=>p.id===product.id);
  return products.map((p,i)=>({p,distance:Math.abs(i-index),i}))
    .filter(({p})=>p.id!==product.id&&p.categoria===product.categoria&&p.disponibilidad!=='agotado'&&hasProductPage(p))
    .sort((a,b)=>a.distance-b.distance||a.i-b.i).slice(0,limit).map(({p})=>p);
}

// Solo se afirma lo que dice la planilla: "disponible" → InStock, "agotado" → OutOfStock.
// "consultar" (o cualquier otro valor) no lleva availability: no se promete stock que no está confirmado.
export function offerAvailability(product){
  if(product?.disponibilidad==='disponible')return 'https://schema.org/InStock';
  if(product?.disponibilidad==='agotado')return 'https://schema.org/OutOfStock';
  return undefined;
}

// products (opcional): el catálogo, para que dos productos con el mismo nombre y presentación no
// compartan el título (se agrega el código).
export function productPageData(product,{currency='ARS',phone='',products=[]}={}){
  const slug=productSlug(product),url=`${SITE_URL}/productos/${slug}`;
  const pack=hasPack(product)?product.presentacion:'';
  const description=cleanDescription(product);
  const price=product.precio>0?money(product.precio,currency):'';
  const metaPrice=product.precio>0?metaMoney(product.precio,currency):'';
  const key=normKey(`${product.nombre}|${pack}`);
  const duplicate=products.some(p=>p.id!==product.id&&normKey(`${p.nombre}|${hasPack(p)?p.presentacion:''}`)===key);
  const base=[product.nombre,pack,duplicate?product.id:''].filter(Boolean).join(' · ');
  const title=`${base} · Vitalia`.length<=TITLE_MAX?`${base} · Vitalia`:base;
  const metaName=stripPendingClaims(product.nombre).replace(/[\s.,;:—-]+$/,'')||product.nombre;
  const lead=`${metaName}${pack?` (${pack})`:''}${metaPrice?` a ${metaPrice}`:''}.`;
  const tail='Pedilo en Vitalia y coordiná la entrega por WhatsApp.';
  const claimFree=stripPendingClaims(description);
  const budget=META_MAX-lead.length-tail.length-2;
  const excerpt=claimFree&&budget>=20?truncate(claimFree,budget-1).replace(/([^.…!?])$/,'$1.'):'';
  let metaDescription=[lead,excerpt,tail].filter(Boolean).join(' ');
  if(metaDescription.length>META_MAX)metaDescription=truncate(metaDescription,META_MAX-1);
  const offer={'@type':'Offer',priceCurrency:currency,url};
  const availability=offerAvailability(product);if(availability)offer.availability=availability;
  if(product.precio>0)offer.price=product.precio;
  const jsonLd={'@context':'https://schema.org','@type':'Product',name:product.nombre,sku:product.id,category:product.categoria,offers:offer};
  const image=absoluteImage(product.imagen);if(image)jsonLd.image=image;
  if(claimFree)jsonLd.description=claimFree;
  return {slug,url,title,metaDescription,description,pack,price,perKilo:pricePerKilo(product),whatsappUrl:whatsappConsultUrl(phone,product),jsonLd};
}

// Categorías en orden de aparición en el catálogo, con su cantidad de productos activos.
export function categoryList(products){
  const map=new Map();
  for(const p of products||[]){const slug=slugify(p.categoria);const entry=map.get(slug)||{name:p.categoria,slug,count:0};entry.count++;map.set(slug,entry);}
  return [...map.values()];
}
export function categoryPageData(products,slug){
  const category=categoryList(products).find(c=>c.slug===slug);
  if(!category)return null;
  const url=`${SITE_URL}/categorias/${category.slug}`;
  const intro=INTROS[category.slug]||'';
  const items=(products||[]).filter(p=>p.categoria===category.name);
  const jsonLd={'@context':'https://schema.org','@type':'CollectionPage',name:category.name,url,inLanguage:'es-AR',isPartOf:{'@id':`${SITE_URL}/#web`}};
  if(intro)jsonLd.description=intro;
  // Meta: solo la primera oración de la intro + "Pedidos por WhatsApp." (la intro visible no cambia).
  const first=(intro.match(/^.*?[.!?](?=\s|$)/)||[intro])[0].trim();
  const metaDescription=first?`${first} Pedidos por WhatsApp.`:'';
  return {...category,url,intro,metaDescription,title:`${category.name} · Vitalia Dietética`,items,jsonLd};
}

// El build falla si algún marcador llega a los datos que se renderizan.
export function findPlaceholders(value,path='$'){
  if(typeof value==='string')return PLACEHOLDERS.some(m=>value.includes(m))?[path]:[];
  if(Array.isArray(value))return value.flatMap((v,i)=>findPlaceholders(v,`${path}[${i}]`));
  if(value&&typeof value==='object')return Object.entries(value).flatMap(([k,v])=>findPlaceholders(v,`${path}.${k}`));
  return [];
}
export function assertNoPlaceholders(value,label){
  const found=findPlaceholders(value);
  if(found.length)throw new Error(`${label}: hay "[A COMPLETAR]" o "[A CONFIRMAR]" en ${found.slice(0,5).join(', ')}. Completá el dato antes de publicar.`);
  return value;
}
