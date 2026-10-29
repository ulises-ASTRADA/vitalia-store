import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {OG_HOME_IMAGE,shareMetadata,productShareImage} from '../lib/og.js';

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
test('Producto: foto propia absoluta con alt sin claims; sin foto, imagen general',()=>{
 const img=productShareImage({imagen:'/images/product-219.webp',nombre:'Yerba kalena sin agrotóxicos sin T.A.C.C'});
 assert.equal(img.url,'https://www.vitalia.energy/images/product-219.webp');assert.equal(img.type,'image/webp');
 assert(!/T\.?A\.?C\.?C/i.test(img.alt),img.alt);assert(img.alt.startsWith('Yerba kalena'));
 assert.equal(productShareImage({imagen:'',nombre:'X'}),OG_HOME_IMAGE);
 assert.equal(productShareImage({imagen:'javascript:alert(1)',nombre:'X'}),OG_HOME_IMAGE);
 const m=shareMetadata({path:'/productos/x-n1',title:'X',image:img});
 assert.equal(m.twitter.card,'summary_large_image');assert.equal(m.twitter.images[0].url,img.url);
});
