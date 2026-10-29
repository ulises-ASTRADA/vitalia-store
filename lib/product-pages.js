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

const absoluteImage=src=>src?.startsWith('/images/')?`${SITE_URL}${src}`:/^https:\/\//.test(src||'')?src:undefined;
const truncate=(text,max)=>{if(text.length<=max)return text;const cut=text.slice(0,max);return cut.slice(0,Math.max(cut.lastIndexOf(' '),40)).replace(/[\s,;:.]+$/,'')+'…';};

export function whatsappConsultUrl(phone,product){
  if(!/^[1-9]\d{7,14}$/.test(phone||''))return '';
  const pack=hasPack(product)?product.presentacion:'presentación a confirmar';
  return `https://wa.me/${phone}?text=${encodeURIComponent(`¡Hola, Vitalia! Quiero consultar por ${product.nombre} (${pack}) · código ${product.id}.`)}`;
}

// ¿El producto tiene página? Activo en el catálogo y fuera de la lista de exclusión.
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

export function productPageData(product,{currency='ARS',phone=''}={}){
  const slug=productSlug(product),url=`${SITE_URL}/productos/${slug}`;
  const pack=hasPack(product)?product.presentacion:'';
  const description=cleanDescription(product);
  const price=product.precio>0?money(product.precio,currency):'';
  const title=[product.nombre,pack,'Vitalia'].filter(Boolean).join(' · ');
  const lead=`${product.nombre}${pack?` (${pack})`:''}${price?` a ${price}`:''}.`;
  const excerpt=description?truncate(description,90).replace(/([^.…!?])$/,'$1.'):'';
  const metaDescription=[lead,excerpt,'Pedilo en Vitalia y coordiná la entrega por WhatsApp.'].filter(Boolean).join(' ');
  const offer={'@type':'Offer',priceCurrency:currency,availability:`https://schema.org/${product.disponibilidad==='agotado'?'OutOfStock':'InStock'}`,url};
  if(product.precio>0)offer.price=product.precio;
  const jsonLd={'@context':'https://schema.org','@type':'Product',name:product.nombre,sku:product.id,category:product.categoria,offers:offer};
  const image=absoluteImage(product.imagen);if(image)jsonLd.image=image;
  if(description)jsonLd.description=description;
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
  return {...category,url,intro,title:`${category.name} · Vitalia Dietética`,items,jsonLd};
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
