import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as envios from '../lib/envios.js';
import {enviosJsonLd,homeJsonLd,serializeJsonLd,DELIVERY_ZONES} from '../lib/seo.js';
import {ENVIOS_PAGE} from '../lib/product-pages.js';

const {enviosPageData,faqItems,SHIPPING_COST,PICKUP_ADDRESS,assertNoMarkerInHtml,localPhone,pesos,costTiers}=envios;
const page=enviosPageData('5491100000000');
const allText=JSON.stringify(page)+serializeJsonLd(enviosJsonLd('5491100000000'))+serializeJsonLd(homeJsonLd('5491100000000'));
const zones=page.groups.flatMap(g=>g.zones);

test('/envios: 9 zonas, una sola lista de costos para secciones, tabla, respuesta y FAQ',()=>{
  assert.equal(zones.length,9);
  assert.deepEqual(new Set(zones.map(z=>z.slug)),new Set(Object.keys(SHIPPING_COST)));
  assert.deepEqual(zones.map(z=>z.name).sort(),DELIVERY_ZONES.map(z=>z.name).sort());
  for(const z of zones){assert.equal(z.costLine,`Envío a ${z.name}: ${pesos(SHIPPING_COST[z.slug])}.`);assert.equal(z.freeLine,'Gratis en compras de más de $70.000.');}
  assert.deepEqual(page.table.map(r=>[r.label,r.value]),[
    ['Villa Allende, Mendiolaza, El Talar, Saldán y Villa Rivera Indarte','$3.000'],
    ['Río Ceballos, Unquillo, La Calera, Argüello y Cerro de las Rosas','$5.000'],
    ['Compras de más de $70.000, todas las zonas','Gratis']]);
  // Cada zona aparece exactamente en una fila de la tabla, con su costo.
  for(const z of zones)assert.equal(costTiers().filter(t=>t.zones.includes(z.name)&&t.cost===z.cost).length,1);
  assert.match(page.answer,/El envío cuesta \$3\.000 o \$5\.000 según la zona, y es gratis en compras de más de \$70\.000\./);
  const faq=faqItems('5491100000000');
  assert.match(faq[6].a,/^Depende de la zona: \$3\.000 a Villa Allende, Mendiolaza, El Talar, Saldán y Villa Rivera Indarte, y \$5\.000 a Río Ceballos, Unquillo, La Calera, Argüello y Cerro de las Rosas\./);
});

test('/envios: datos confirmados el 28/10 (El Talar, countries, Golf/Lomas/Parque, retiro sin calle)',()=>{
  const by=Object.fromEntries(zones.map(z=>[z.slug,z]));
  assert.equal(by.mendiolaza.question,'¿Qué dietética llega a Mendiolaza y El Talar?');
  assert.equal(by.mendiolaza.cost,3000);
  assert.equal(by['la-calera'].line,'Sí, Vitalia envía a La Calera, también a countries y barrios cerrados.');
  assert(by['villa-allende'].line.endsWith('También llegamos a Villa Allende Golf, Lomas y Villa Allende Parque.'));
  assert.equal(faqItems()[3].q,'¿Envían a Mendiolaza y El Talar?');
  assert.equal(PICKUP_ADDRESS,null);
  assert.equal(page.pickup.line,'Retiro en Villa Allende, coordinamos la dirección por WhatsApp.');
  assert.equal(page.pickup.mapsUrl,'');
  for(const banned of ['1504','De la Unión','De La Union','streetAddress','google.com/maps','openingHours'])assert(!allText.includes(banned),banned);
  assert.equal(ENVIOS_PAGE,true);
  // Sin pedido mínimo (confirmado por la tienda, 28/10): FAQ 9 justo después de "¿Hay envío gratis?" y línea en las condiciones.
  const faq=faqItems();assert.equal(faq[7].q,'¿Hay envío gratis?');
  assert.deepEqual(faq[8],{q:'¿Hay pedido mínimo?',a:'No, no hay pedido mínimo: podés pedir el monto que quieras. En compras de más de $70.000, el envío es gratis.'});
  assert.deepEqual(page.terms.at(-1),['Pedido mínimo','Sin pedido mínimo']);
});

test('/envios: FAQPage con las 13 preguntas visibles, respuestas completas y la tienda por @id',()=>{
  const graph=enviosJsonLd('5491100000000')['@graph'];
  const faq=graph.find(n=>n['@type']==='FAQPage');
  assert.equal(faq.mainEntity.length,13);
  assert.deepEqual(faq.mainEntity.map(q=>[q.name,q.acceptedAnswer.text]),page.faq.map(f=>[f.q,f.a]));
  for(const f of page.faq){assert(f.q.endsWith('?'));assert(f.a.length>30);}
  assert.equal(graph.find(n=>n['@type']==='WebPage').about['@id'],'https://www.vitalia.energy/#tienda');
  assert.deepEqual(graph.find(n=>n['@type']==='BreadcrumbList').itemListElement.map(i=>i.name),['Inicio','Envíos']);
  assert.equal(graph.find(n=>n['@type']==='HealthFoodStore'),undefined);
  assert(page.faq[12].a.includes('al 11 0000-0000'));
  // Sin número válido no se publica ningún número ni link de WhatsApp.
  assert(!faqItems('')[12].a.includes(' al '));assert.equal(enviosPageData('').zones?.length,undefined);
  assert(enviosPageData('').groups.flatMap(g=>g.zones).every(z=>z.whatsappUrl===''));
});

test('Home: HealthFoodStore con localidad sin calle, Instagram, medios de pago y 9 zonas, sin horarios',()=>{
  const store=homeJsonLd('5491100000000')['@graph'].find(n=>n['@type']==='HealthFoodStore');
  assert.deepEqual(store.address,{'@type':'PostalAddress',addressLocality:'Villa Allende',addressRegion:'Córdoba',addressCountry:'AR'});
  assert.deepEqual(store.sameAs,['https://www.instagram.com/vitalia_energy/']);
  assert.equal(store.paymentAccepted,'Transferencia, Efectivo');
  assert.equal(store.areaServed.length,9);
  assert.equal(store.openingHours,undefined);assert.equal(store.openingHoursSpecification,undefined);
});

test('/envios: el guard del build falla con "[A " en cualquier parte del HTML',()=>{
  assert.doesNotThrow(()=>assertNoMarkerInHtml(allText));
  assert(!allText.includes('[A '));
  assert.throws(()=>assertNoMarkerInHtml('<p>Pedido mínimo: [A CONFIRMAR]</p>'),/\[A /);
  assert.throws(()=>assertNoMarkerInHtml('<meta content="[A COMPLETAR]">'),/marcador/);
  // El componente no tiene copy fijo con marcadores.
  assert(!readFileSync(new URL('../components/envios-page.jsx',import.meta.url),'utf8').includes('[A '));
});

test('/envios: formato del teléfono para la FAQ 13 sale de WHATSAPP_NUMBER',()=>{
  assert.equal(localPhone('5493513947394'),'351 394-7394');
  assert.equal(localPhone('5491100000000'),'11 0000-0000');
  assert.equal(localPhone('abc'),'');
});

test('llms.txt: zonas, costos, pagos, Instagram y /envios, sin dirección',()=>{
  const llms=readFileSync(new URL('../public/llms.txt',import.meta.url),'utf8');
  for(const z of zones)assert(llms.includes(z.name),z.name);
  for(const t of costTiers())assert(llms.includes(`${t.label} a ${t.zones.join(', ').replace(/, ([^,]+)$/,' y $1')}`),t.label);
  assert(llms.includes('Gratis en compras de más de $70.000'));
  assert(llms.includes('transferencia o efectivo'));
  assert(llms.includes('https://www.vitalia.energy/envios'));
  assert(llms.includes('https://www.instagram.com/vitalia_energy/'));
  for(const banned of ['1504','De la Unión','consultar por WhatsApp.'])assert(!llms.includes(banned),banned);
});

test('Sitemap y SectionNav incluyen /envios; el proxy le pone nonce',()=>{
  assert.match(readFileSync(new URL('../app/sitemap.js',import.meta.url),'utf8'),/'\/envios'/);
  assert.match(readFileSync(new URL('../components/section-nav.jsx',import.meta.url),'utf8'),/href="\/envios"[^>]*>Envíos</);
  assert.match(readFileSync(new URL('../proxy.js',import.meta.url),'utf8'),/'\/envios'/);
});
