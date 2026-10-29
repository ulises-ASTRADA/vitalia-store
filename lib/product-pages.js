// Datos de las páginas de producto y categoría (Fase 1). Todo sale del catálogo en vivo
// y de data/categorias.json (intros escritas por diseño). No se inventa nada.
import categoryIntros from '../data/categorias.json' with {type:'json'};
import {SITE_URL} from './seo.js';
import {slugify,productSlug,hasProductPage,findBySlug} from './product-links.js';
import {stripPendingClaims,claimFreeName} from './claims.js';

export const PLACEHOLDERS=['[A COMPLETAR]','[A CONFIRMAR]'];
const INTROS=Object.fromEntries(Object.entries(categoryIntros).map(([name,value])=>[slugify(name),value.intro]));

// Hasta que exista /envios, la línea de envíos va sin link (no se enlaza a un 404).
export const ENVIOS_PAGE=true;
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

// Claims pendientes (sin TACC, sin gluten, sin azúcar…): ver lib/claims.js. Se filtran de title,
// og/twitter, slug, meta description y JSON-LD; el nombre visible no cambia.
export {FILTER_PENDING_CLAIMS,PENDING_CLAIMS,stripPendingClaims,claimFreeName} from './claims.js';

// Restos de la planilla que no aportan en la meta: "por 450", "×500 GR", "Presentación: 50ml.",
// "Por 1 KG" al final… Se sacan; si no queda texto, la meta va sin extracto. No se inventa nada.
const UNIT='(?:kg|kgs|kilos?|g|gr|grs|gramos|ml|cc|cm3|l|lt|lts|litros?)';
const MEASURE=`(?:por|x|×)\\s*\\d+(?:[.,]\\d+)?\\s*${UNIT}\\.?`;
export function metaExcerptSource(text){
  let out=String(text||'').replace(/\s+/g,' ').trim();
  if(new RegExp(`^(?:presentaci[oó]n:?\\s*)?(?:(?:por|x|×)\\s*)?\\d+(?:[.,]\\d+)?\\s*${UNIT}?\\.?$`,'i').test(out))return '';
  out=out.replace(new RegExp(`presentaci[oó]n:?\\s*\\d+(?:[.,]\\d+)?\\s*${UNIT}\\.?`,'gi'),'')
    .replace(new RegExp(`(^|[\\s,.;])${MEASURE}(?=[\\s,.;]|$)`,'gi'),'$1')
    .replace(new RegExp(`(^|\\s)\\d+(?:[.,]\\d+)?\\s*${UNIT}\\.?(?=\\s|$)`,'gi'),'$1')
    .replace(/\s+([,.;:])/g,'$1').replace(/([,;:])(?=\s*(?:[.]|$))/g,'').replace(/\.(?:\s*\.)+/g,'.').replace(/\s{2,}/g,' ').replace(/^[\s,;:.]+/,'').trim();
  return out?out[0].toLocaleUpperCase('es-AR')+out.slice(1):'';
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
  // Para Google (title, og/twitter, JSON-LD, meta) el nombre va sin claims; el h1 y la tarjeta, con el original.
  const seoName=claimFreeName(product.nombre);
  const key=normKey(`${seoName}|${pack}`);
  const duplicate=products.some(p=>p.id!==product.id&&normKey(`${claimFreeName(p.nombre)}|${hasPack(p)?p.presentacion:''}`)===key);
  const base=[seoName,pack,duplicate?product.id:''].filter(Boolean).join(' · ');
  const title=`${base} · Vitalia`.length<=TITLE_MAX?`${base} · Vitalia`:base;
  const lead=`${seoName}${pack?` (${pack})`:''}${metaPrice?` a ${metaPrice}`:''}.`;
  const tail='Pedilo en Vitalia y coordiná la entrega por WhatsApp.';
  const claimFree=metaExcerptSource(stripPendingClaims(description));
  // Extracto que solo repite palabras del nombre ("Entrenuts" tras sacar "Por 200cc") no va en la meta.
  const words=text=>String(text).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().match(/[a-z0-9]+/g)||[];
  const leadWords=new Set(words(`${product.nombre} ${pack}`));
  const metaExcerpt=words(claimFree).every(w=>leadWords.has(w))?'':claimFree;
  const budget=META_MAX-lead.length-tail.length-2;
  const excerpt=metaExcerpt&&budget>=20?truncate(metaExcerpt,budget-1).replace(/([^.…!?])$/,'$1.'):'';
  let metaDescription=[lead,excerpt,tail].filter(Boolean).join(' ');
  if(metaDescription.length>META_MAX)metaDescription=truncate(metaDescription,META_MAX-1);
  const offer={'@type':'Offer',priceCurrency:currency,url};
  const availability=offerAvailability(product);if(availability)offer.availability=availability;
  if(product.precio>0)offer.price=product.precio;
  const jsonLd={'@context':'https://schema.org','@type':'Product',name:seoName,sku:product.id,category:product.categoria,offers:offer};
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
