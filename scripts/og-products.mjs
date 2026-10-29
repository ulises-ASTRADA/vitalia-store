import sharp from 'sharp';
import {createHash} from 'node:crypto';
import {readdir,readFile,open,rename,unlink,access} from 'node:fs/promises';
import {getCatalog,storeSettings} from '../lib/catalog.js';
// Versión para compartir (og:image) de cada foto de producto: JPG de hasta 1200 px de ancho (sin agrandar),
// de menos de 300 KB. Algunas versiones de WhatsApp no muestran webp y descartan imágenes de más de 300 KB.
// La foto original de la ficha no se toca. El manifiesto guarda ancho y alto para og:image:width/height.
// Fotos locales: public/images/product-*. Fotos del Sheet en un CDN permitido: se bajan en el build;
// si una no se puede bajar, queda la versión anterior (si existe) o la página comparte la foto original.
const SRC='public/images',OUT='public/og/products',MANIFEST='lib/og-products.js';
const MAX_WIDTH=1200,MAX_BYTES=300*1024,MAX_DOWNLOAD=15*1024*1024;
const REMOTE_HOSTS=new Set(['cdn.quicksell.co']);
async function writeAtomic(path,bytes){
  try{if((await readFile(path)).equals(bytes))return false;}catch{}
  const handle=await open(path+'.pending','w');
  try{await handle.writeFile(bytes);await handle.sync();}finally{await handle.close();}
  await rename(path+'.pending',path);return true;
}
const exists=path=>access(path).then(()=>true,()=>false);
export async function shareJpg(input){
  for(const quality of [82,74,66,58,50]){
    const {data,info}=await sharp(input,{limitInputPixels:50e6}).rotate().resize({width:MAX_WIDTH,withoutEnlargement:true}).flatten({background:'#ffffff'})
      .jpeg({quality,mozjpeg:true}).toBuffer({resolveWithObject:true});
    if(data.length<MAX_BYTES)return {data,width:info.width,height:info.height};
  }
  throw new Error('no baja de 300 KB');
}
export const remoteAllowed=src=>{try{const u=new URL(src);return u.protocol==='https:'&&REMOTE_HOSTS.has(u.hostname);}catch{return false;}};
async function download(src){
  const r=await fetch(src,{signal:AbortSignal.timeout(15000),redirect:'error'});
  if(!r.ok)throw new Error(`HTTP ${r.status}`);
  if(!/^image\//.test(r.headers.get('content-type')||''))throw new Error('no es una imagen');
  const b=Buffer.from(await r.arrayBuffer());if(b.length>MAX_DOWNLOAD)throw new Error('demasiado grande');
  return b;
}
let previous={};
try{previous=(await import(`../${MANIFEST}?t=${Date.now()}`)).OG_PRODUCT_IMAGES||{};}catch{}

const manifest={};let changed=0;const problems=[];
async function add(src,name,input){
  const {data,width,height}=await shareJpg(input);
  if(await writeAtomic(`${OUT}/${name}.jpg`,data))changed++;
  manifest[src]={url:`/og/products/${name}.jpg`,width,height,bytes:data.length};
}
for(const file of (await readdir(SRC)).filter(f=>/^product-[\w-]+\.(webp|jpe?g|png)$/i.test(f)).sort())
  await add(`/images/${file}`,file.replace(/\.[^.]+$/,''),`${SRC}/${file}`);

// Fotos externas del Sheet. Sin Sheet (preview o sin conexión) se conservan las del build anterior.
const keepPrevious=()=>{for(const [src,m] of Object.entries(previous))if(!src.startsWith('/')&&!manifest[src])manifest[src]=m;};
let remote=null;
try{if(!storeSettings().isPreview)remote=[...new Set((await getCatalog({fresh:true})).products.map(p=>p.imagen).filter(remoteAllowed))].sort();}
catch(e){problems.push(`catálogo: ${e.message}`);}
if(remote){
  const queue=[...remote];
  await Promise.all(Array.from({length:6},async()=>{for(let src;(src=queue.shift());){
    const name='ext-'+createHash('sha256').update(src).digest('hex').slice(0,16);
    try{await add(src,name,await download(src));}
    catch(e){problems.push(`${src}: ${e.message}`);if(previous[src]&&await exists(`public${previous[src].url}`))manifest[src]=previous[src];}
  }}));
}else keepPrevious();
const sorted=Object.fromEntries(Object.entries(manifest).sort(([a],[b])=>a<b?-1:a>b?1:0));
const keep=new Set(Object.values(sorted).map(m=>m.url.split('/').pop()));
for(const f of await readdir(OUT))if(f.endsWith('.jpg')&&!keep.has(f)){await unlink(`${OUT}/${f}`);changed++;}
await writeAtomic(MANIFEST,Buffer.from(`// Generado por scripts/og-products.mjs (npm run build). No editar a mano.\nexport const OG_PRODUCT_IMAGES=${JSON.stringify(sorted,null,1)};\n`));
const all=Object.values(sorted),max=Math.max(...all.map(m=>m.bytes));
console.log(`og-products: ${all.length} JPG para compartir (${all.filter(m=>m.url.includes('/ext-')).length} del Sheet, ${changed} cambiaron), el más pesado ${Math.round(max/1024)} KB`);
for(const p of problems)console.warn(`og-products: aviso, ${p}`);
