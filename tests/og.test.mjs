import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {OG_HOME_IMAGE,shareMetadata,productShareImage} from '../lib/og.js';
import {OG_PRODUCT_IMAGES} from '../lib/og-products.js';

const ALT='Vitalia: alimentos naturales a domicilio en Villa Allende';
test('og-home.png existe, es PNG 1200×630 y pesa ~60 KB',async()=>{
 const buf=await readFile(new URL('../public/og/og-home.png',import.meta.url));
 assert.equal(buf.subarray(1,4).toString(),'PNG');assert.equal(buf.readUInt32BE(16),1200);assert.equal(buf.readUInt32BE(20),630);
 assert(buf.length>40000&&buf.length<100000,String(buf.length));
});
test('Home, categorías, /envios y /boxes: og:image absoluta 1200×630 y summary_large_image',()=>{
 const m=shareMetadata({path:'/envios',title:'T',description:'D'});
 assert.deepEqual(m.openGraph.images,[{url:'https://www.vitalia.energy/og/og-home.png',width:1200,height:630,type:'image/png',alt:ALT}]);
 assert.equal(m.openGraph.url,'https://www.vitalia.energy/envios');assert.equal(m.openGraph.locale,'es_AR');assert.equal(m.openGraph.siteName,'Vitalia');
 assert.equal(m.twitter.card,'summary_large_image');assert.deepEqual(m.twitter.images,[{url:OG_HOME_IMAGE.url,alt:ALT}]);
 assert.equal(m.openGraph.title,m.twitter.title);assert.equal(m.openGraph.description,'D');
 assert.equal('description' in shareMetadata({path:'/',title:'T'}).openGraph,false);
});
test('Producto: JPG para compartir absoluto con tipo, ancho y alto, alt sin claims; sin foto, imagen general',()=>{
 const img=productShareImage({imagen:'/images/product-219.webp',nombre:'Yerba kalena sin agrotóxicos sin T.A.C.C'});
 assert.equal(img.url,'https://www.vitalia.energy/og/products/product-219.jpg');assert.equal(img.type,'image/jpeg');
 assert.equal(img.width,OG_PRODUCT_IMAGES['/images/product-219.webp'].width);assert.equal(img.height,OG_PRODUCT_IMAGES['/images/product-219.webp'].height);
 assert(!/T\.?A\.?C\.?C/i.test(img.alt),img.alt);assert(img.alt.startsWith('Yerba kalena'));
 assert.equal(productShareImage({imagen:'',nombre:'X'}),OG_HOME_IMAGE);
 assert.equal(productShareImage({imagen:'javascript:alert(1)',nombre:'X'}),OG_HOME_IMAGE);
 assert.equal(productShareImage({imagen:'/images/no-existe.webp',nombre:'X'}),OG_HOME_IMAGE);
 assert.equal(productShareImage({imagen:'__proto__',nombre:'X'}),OG_HOME_IMAGE);
 const m=shareMetadata({path:'/productos/x-n1',title:'X',image:img});
 assert.equal(m.twitter.card,'summary_large_image');assert.equal(m.twitter.images[0].url,img.url);
});

const jpgSize=buf=>{ // SOF0/SOF2 → [ancho, alto]
 assert.equal(buf.readUInt16BE(0),0xFFD8);
 for(let i=2;i<buf.length;){const marker=buf.readUInt16BE(i),len=buf.readUInt16BE(i+2);
  if(marker>=0xFFC0&&marker<=0xFFCF&&![0xFFC4,0xFFC8,0xFFCC].includes(marker))return [buf.readUInt16BE(i+7),buf.readUInt16BE(i+5)];
  i+=2+len;}
 throw new Error('JPG sin SOF');
};
test('Cada foto de producto (local o del Sheet) tiene su JPG para compartir: <300 KB, ≤1200 px sin agrandar, medidas del manifiesto; el webp original sigue',async()=>{
 const sharp=(await import('sharp')).default;
 const photos=readdirSync(new URL('../public/images/',import.meta.url)).filter(f=>/^product-[\w-]+\.(webp|jpe?g|png)$/i.test(f));
 assert.equal(photos.length,295);
 const local=Object.keys(OG_PRODUCT_IMAGES).filter(s=>s.startsWith('/'));
 assert.deepEqual(local.sort(),photos.map(f=>`/images/${f}`).sort());
 // Fotos del Sheet en el CDN permitido (N296 en adelante): también tienen su JPG.
 const remote=Object.keys(OG_PRODUCT_IMAGES).filter(s=>!s.startsWith('/'));
 assert(remote.length>=59,String(remote.length));
 for(const src of remote){assert.equal(new URL(src).protocol,'https:');assert.equal(new URL(src).hostname,'cdn.quicksell.co');assert.match(OG_PRODUCT_IMAGES[src].url,/^\/og\/products\/ext-[0-9a-f]{16}\.jpg$/);}
 const ext=productShareImage({imagen:remote[0],nombre:'X'});
 assert.equal(ext.type,'image/jpeg');assert(ext.url.startsWith('https://www.vitalia.energy/og/products/ext-'));assert(ext.width>0&&ext.height>0);
 for(const [src,m] of Object.entries(OG_PRODUCT_IMAGES)){
  assert(m.width<=1200,src);
  const buf=readFileSync(new URL(`../public${m.url}`,import.meta.url));
  assert(buf.length<300*1024,`${m.url}: ${buf.length}`);assert.equal(buf.length,m.bytes,m.url);
  assert.deepEqual(jpgSize(buf),[m.width,m.height],m.url);
  if(!src.startsWith('/'))continue;
  const source=await sharp(new URL(`../public${src}`,import.meta.url).pathname).metadata();
  assert.equal(m.width,Math.min(1200,source.width),src);
  assert(Math.abs(m.height-Math.round(source.height*m.width/source.width))<=1,src);
 }
 // N001: el webp pesado de la ficha no se toca; se comparte el JPG liviano.
 assert(statSync(new URL('../public/images/product-001.webp',import.meta.url)).size>300*1024);
 assert(OG_PRODUCT_IMAGES['/images/product-001.webp'].bytes<300*1024);
 assert.match(readFileSync(new URL('../package.json',import.meta.url),'utf8'),/node scripts\/og-products\.mjs && next build/);
});

test('Descarga de fotos: tope de 15 MB por content-length y por bytes recibidos',async()=>{
 const {readCapped,MAX_DOWNLOAD}=await import('../scripts/og-download.mjs');
 assert.equal(MAX_DOWNLOAD,15*1024*1024);
 let pulled=0;
 const body=n=>new ReadableStream({pull(c){pulled++;if(pulled>n)c.close();else c.enqueue(new Uint8Array(1024));}});
 // header mayor al tope: se rechaza sin leer el cuerpo
 pulled=0;let ab=new AbortController();
 await assert.rejects(readCapped(new Response(body(10),{headers:{'content-length':String(MAX_DOWNLOAD+1)}}),MAX_DOWNLOAD,ab),/demasiado grande/);
 assert.equal(ab.signal.aborted,true);assert(pulled<=1,String(pulled));
 // sin header (o header falso chico): corta apenas se pasa del tope
 pulled=0;ab=new AbortController();
 await assert.rejects(readCapped(new Response(body(1e6)),4096,ab),/demasiado grande/);
 assert.equal(ab.signal.aborted,true);assert(pulled<10,String(pulled));
 pulled=0;
 await assert.rejects(readCapped(new Response(body(1e6),{headers:{'content-length':'100'}}),4096),/demasiado grande/);
 assert(pulled<10,String(pulled));
 // dentro del tope: devuelve todo
 pulled=0;const b=await readCapped(new Response(body(3)),4096);assert.equal(b.length,3072);
});
