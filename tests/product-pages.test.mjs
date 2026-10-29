import test from 'node:test';
import assert from 'node:assert/strict';
import {slugify,productSlug,productPath,findBySlug} from '../lib/product-links.js';
import * as productLinks from '../lib/product-links.js';
import localCatalog from '../data/catalog.json' with {type:'json'};
import {cleanDescription,pricePerKilo,productPageData,relatedProducts,categoryList,categoryPageData,pageProducts,resolveProduct,assertNoPlaceholders,whatsappConsultUrl,offerAvailability,metaMoney,stripPendingClaims,FILTER_PENDING_CLAIMS} from '../lib/product-pages.js';
import categorias from '../data/categorias.json' with {type:'json'};
const fixtureCatalog=()=>(Array.isArray(localCatalog)?localCatalog:localCatalog.products);
const p=(id,nombre,categoria,extra={})=>({id,nombre,categoria,precio:1000,presentacion:'1 KG',disponibilidad:'consultar',descripcion:'',imagen:`/images/product-${id}.webp`,...extra});

test('Slugs: nombre + código, sin acentos ni símbolos',()=>{
  assert.equal(productSlug(p('N037','Granola tradicional','Granolas y cereales')),'granola-tradicional-n037');
  assert.equal(productSlug(p('N038','Granola de chocolate "Vitalia"','Granolas y cereales')),'granola-de-chocolate-vitalia-n038');
  assert.equal(slugify('Harinas, pastas y legumbres'),'harinas-pastas-y-legumbres');
  assert.equal(slugify('Almacén'),'almacen');
});
test('Se resuelve por el código del final, aunque cambie el nombre',()=>{
  const products=[p('N037','Granola tradicional','Granolas'),p('N1037','Otra','Granolas')];
  assert.equal(findBySlug(products,'granola-tradicional-n037').id,'N037');
  assert.equal(findBySlug(products,'granola-vieja-n037').id,'N037');
  assert.equal(findBySlug(products,'otra-n1037').id,'N1037');
  assert.equal(findBySlug(products,'nada-n999'),null);
  assert.deepEqual(resolveProduct(products,'granola-vieja-n037').canonicalSlug,'granola-tradicional-n037');
});
test('N296 y N297 (aceites de CBD) tienen página como cualquier producto, aunque el catálogo local no los tenga',()=>{
  assert.equal(productLinks.NO_PRODUCT_PAGE,undefined);
  // Fixture con los datos de la planilla en vivo (28/10): el data/catalog.json local no trae N296/N297 activos.
  assert.equal(localCatalog.some(x=>['N296','N297'].includes(x.id)&&x.activo!==false),false);
  const cbd=(id,nombre,precio,presentacion)=>p(id,nombre,'Suplementos',{precio,presentacion,descripcion:'',disponibilidad:'consultar'});
  const products=[p('N165','Maca peruana','Suplementos',{presentacion:'500 GR'}),cbd('N296','Aceite de CBD al 40% — uso oral',9100,'20 ml'),cbd('N297','Aceite de CBD al 20% — uso oral',11200,'40 ml')];
  assert.equal(productPath(products[1]),'/productos/aceite-de-cbd-al-40-uso-oral-n296');
  assert.equal(productPath(products[2]),'/productos/aceite-de-cbd-al-20-uso-oral-n297');
  assert.deepEqual(pageProducts(products).map(x=>x.id),['N165','N296','N297']);
  assert.equal(resolveProduct(products,'aceite-de-cbd-al-40-uso-oral-n296').product.id,'N296');
  assert.equal(resolveProduct(products,'otro-nombre-n297').canonicalSlug,'aceite-de-cbd-al-20-uso-oral-n297');
  assert.equal(categoryPageData(products,'suplementos').items.length,3);
  assert.deepEqual(relatedProducts(products,products[0]).map(x=>x.id),['N296','N297']);
  assert.deepEqual(relatedProducts(products,products[1]).map(x=>x.id),['N165','N297']);
  // Página solo con datos de la planilla: sin descripción (se oculta), sin texto de salud, sin availability inventado.
  const page=productPageData(products[1],{phone:'5491100000000'});
  assert.equal(page.title,'Aceite de CBD al 40% — uso oral · 20 ml · Vitalia');
  assert.equal(page.description,'');assert.equal(page.jsonLd.description,undefined);
  assert.equal(page.metaDescription,'Aceite de CBD al 40% — uso oral (20 ml) a $9.100. Pedilo en Vitalia y coordiná la entrega por WhatsApp.');
  assert.equal(page.jsonLd.offers.availability,undefined);assert.equal(page.jsonLd.offers.price,9100);
  assert.doesNotMatch(JSON.stringify(page),/salud|terap|medic|beneficio|dolor|ansiedad/i);
});
test('Disponibilidad del JSON-LD: InStock solo si está disponible, OutOfStock si está agotado, y nada si es a consultar',()=>{
  const base=p('N1','X','Y');
  assert.equal(offerAvailability({...base,disponibilidad:'disponible'}),'https://schema.org/InStock');
  assert.equal(offerAvailability({...base,disponibilidad:'agotado'}),'https://schema.org/OutOfStock');
  assert.equal(offerAvailability({...base,disponibilidad:'consultar'}),undefined);
  assert.equal(offerAvailability({...base,disponibilidad:''}),undefined);
  const offers=productPageData({...base,disponibilidad:'consultar'}).jsonLd.offers;
  assert.equal('availability' in offers,false);
  assert.equal(productPageData({...base,disponibilidad:'disponible'}).jsonLd.offers.availability,'https://schema.org/InStock');
});
test('Descripción sin la presentación repetida',()=>{
  assert.equal(cleanDescription(p('N018','X','Y',{descripcion:'1 KG'})),'');
  assert.equal(cleanDescription(p('N045','X','Y',{presentacion:'5 KG',descripcion:'Por 5 KG'})),'');
  assert.equal(cleanDescription(p('N046','X','Y',{presentacion:'5 KG',descripcion:'Por 5 KG. Avena y miel'})),'Avena y miel');
  assert.equal(cleanDescription(p('N042','X','Y',{presentacion:'14 unidades',descripcion:'14 unidades Maní con chocolate'})),'Maní con chocolate');
  assert.equal(cleanDescription(p('N037','X','Y',{descripcion:'Avena, arroz\ny coco'})),'Avena, arroz y coco');
});
test('Precio por kilo solo para pesos distintos de 1 kg',()=>{
  assert.equal(pricePerKilo(p('a','X','Y',{presentacion:'5 KG',precio:30000})),6000);
  assert.equal(pricePerKilo(p('a','X','Y',{presentacion:'500 GR',precio:3000})),6000);
  assert.equal(pricePerKilo(p('a','X','Y',{presentacion:'1 KG'})),null);
  assert.equal(pricePerKilo(p('a','X','Y',{presentacion:'Consultar presentación'})),null);
  assert.equal(pricePerKilo(p('a','X','Y',{presentacion:'14 unidades'})),null);
});
test('Datos de la página: título, meta, JSON-LD y WhatsApp',()=>{
  const product=p('N037','Granola tradicional','Granolas y cereales',{precio:7700,disponibilidad:'disponible',descripcion:'Avena, arroz, copos de maíz, mix de semillas, miel, maní y coco'});
  const page=productPageData(product,{currency:'ARS',phone:'5491100000000'});
  assert.equal(page.title,'Granola tradicional · 1 KG · Vitalia');
  assert.match(page.metaDescription,/^Granola tradicional \(1 KG\) a \$7\.700\. Avena, .* Pedilo en Vitalia y coordiná la entrega por WhatsApp\.$/);
  assert.equal(page.jsonLd['@type'],'Product');assert.equal(page.jsonLd.offers.price,7700);assert.equal(page.jsonLd.offers.priceCurrency,'ARS');
  assert.equal(page.jsonLd.offers.availability,'https://schema.org/InStock');assert.equal(page.jsonLd.image,'https://www.vitalia.energy/images/product-N037.webp');
  assert.equal(page.jsonLd.aggregateRating,undefined);assert.equal(page.jsonLd.review,undefined);
  assert.equal(decodeURIComponent(page.whatsappUrl),'https://wa.me/5491100000000?text=¡Hola, Vitalia! Quiero consultar por Granola tradicional (1 KG) · código N037.');
  assert.equal(productPageData({...product,disponibilidad:'agotado'}).jsonLd.offers.availability,'https://schema.org/OutOfStock');
  assert.equal(whatsappConsultUrl('',product),'');
  assert.equal(productPageData({...product,presentacion:'Consultar presentación'}).title,'Granola tradicional · Vitalia');
});
test('Relacionados: misma categoría, sin agotados, por cercanía y hasta 4',()=>{
  const products=['A','B','C','D','E','F','G'].map((x,i)=>p(`N00${i}`,x,i===6?'Otra':'Granolas',{disponibilidad:i===2?'agotado':'consultar'}));
  assert.deepEqual(relatedProducts(products,products[3]).map(x=>x.nombre),['E','B','F','A']);
});
test('Categorías: intro de diseño, 404 si no existe',()=>{
  const products=[p('N1','A','Granolas y cereales'),p('N2','B','Categoría nueva')];
  assert.deepEqual(categoryList(products).map(c=>c.slug),['granolas-y-cereales','categoria-nueva']);
  const data=categoryPageData(products,'granolas-y-cereales');
  assert.equal(data.intro,categorias['Granolas y cereales'].intro);assert.equal(data.title,'Granolas y cereales · Vitalia Dietética');
  assert.equal(categoryPageData(products,'categoria-nueva').intro,'');
  assert.equal(categoryPageData(products,'nada'),null);
});
test('Intros sin marcadores ni texto de salud; Suplementos nombra los aceites de CBD',()=>{
  for(const [name,{intro}] of Object.entries(categorias)){
    assert.doesNotThrow(()=>assertNoPlaceholders(intro,name));
    assert.doesNotMatch(intro,/salud|terap|medicinal|beneficio/i,name);
  }
  assert.match(categorias.Suplementos.intro,/^Maca peruana, colágeno hidrolizado y aceites de CBD\./);
});
test('Un marcador en los datos de la página corta el build',()=>{
  const product=p('N1','Granola [A COMPLETAR]','Granolas');
  assert.throws(()=>assertNoPlaceholders(productPageData(product),'/productos'),/A COMPLETAR/);
  assert.throws(()=>assertNoPlaceholders({intro:'Texto [A CONFIRMAR]'},'/categorias'),/A CONFIRMAR/);
});

test('Meta description: hasta 155 caracteres, corte en palabra con "…"',()=>{
  const long='Avena arrollada, arroz inflado, copos de maíz, mix de semillas de girasol, lino y sésamo, miel pura de abejas, maní tostado sin sal y coco rallado de primera calidad';
  const page=productPageData(p('N037','Granola tradicional','Granolas y cereales',{precio:7700,descripcion:long}));
  assert(page.metaDescription.length<=155,page.metaDescription.length);
  assert.match(page.metaDescription,/^Granola tradicional \(1 KG\) a \$7\.700\. Avena arrollada, .*\S… Pedilo en Vitalia y coordiná la entrega por WhatsApp\.$/);
  const cut=page.metaDescription.split(' Pedilo')[0];assert(long.includes(cut.replace(/^.*?\. /,'').replace('…','')));
  assert.ok(page.metaDescription.length>140,'usa el espacio disponible');
  const short=productPageData(p('N1','Maní','Frutos secos',{precio:4200,descripcion:'Tostado sin sal'}));
  assert.equal(short.metaDescription,'Maní (1 KG) a $4.200. Tostado sin sal. Pedilo en Vitalia y coordiná la entrega por WhatsApp.');
  for(const product of fixtureCatalog())assert(productPageData(product,{products:fixtureCatalog()}).metaDescription.length<=155,product.id);
});
test('Precios sin centavos en title/meta y títulos de más de 60 sin " · Vitalia"',()=>{
  assert.equal(metaMoney(9100),'$9.100');assert.equal(metaMoney(7839.999999999999),'$7.840');assert.equal(metaMoney(950),'$950');
  const long=productPageData(p('N9','Mix de frutos secos premium tostados con miel y sal marina','Frutos secos',{presentacion:'500 GR'}));
  assert.equal(long.title,'Mix de frutos secos premium tostados con miel y sal marina · 500 GR');
  const ok=productPageData(p('N9','Granola tradicional','Granolas'));assert.equal(ok.title,'Granola tradicional · 1 KG · Vitalia');
  for(const product of fixtureCatalog()){const t=productPageData(product).title;assert(t.length<=60||!t.endsWith(' · Vitalia'),t);}
});
test('Nombres repetidos: el título suma presentación o código para no duplicarse',()=>{
  const list=[p('N184','Almohaditas de avellana','Cereales',{presentacion:'1 KG'}),p('N188','Almohaditas de avellana','Cereales',{presentacion:'1 KG'}),p('N185','Almohaditas de chocolate','Cereales',{presentacion:'1 KG'}),p('N191','Almohaditas de chocolate','Cereales',{presentacion:'2.5 KG'}),p('N048','Gelatina sin sabor premium','X',{presentacion:'1 KG'}),p('N328','Gelatina sin sabor premium','X',{presentacion:'1 kg'})];
  const titles=list.map(x=>productPageData(x,{products:list}).title);
  assert.deepEqual(titles,['Almohaditas de avellana · 1 KG · N184 · Vitalia','Almohaditas de avellana · 1 KG · N188 · Vitalia','Almohaditas de chocolate · 1 KG · Vitalia','Almohaditas de chocolate · 2.5 KG · Vitalia','Gelatina sin sabor premium · 1 KG · N048 · Vitalia','Gelatina sin sabor premium · 1 kg · N328 · Vitalia']);
  const all=fixtureCatalog();const seen=new Set();
  for(const product of all){const t=productPageData(product,{products:all}).title;assert(!seen.has(t),`título repetido: ${t}`);seen.add(t);}
});
test('Claims sin confirmar (T.A.C.C., gluten, azúcar) fuera de meta y JSON-LD; el texto visible no cambia',()=>{
  assert.equal(FILTER_PENDING_CLAIMS,true);
  const cases={'Sin T.A.C.C':'','Libre de gluten, sin T.A.C.C':'','Gluten free':'','Sin azúcar agregada, sin T.A.C.C':'','Barrita de avena sin T.A.C.C.':'Barrita de avena','Huevo, avena y durazno. Sin harinas refinadas ni azúcar':'Huevo, avena y durazno.','Nachos sabor Calabrés sin gluten y sin lácteos':'Nachos sabor Calabrés sin lácteos','Crackers al Curry sin gluten, sin conservantes ni lácteos':'Crackers al Curry sin conservantes ni lácteos','Alfajor brownie — Calafate (sin gluten)':'Alfajor brownie — Calafate','Chips de chocolate. Sin harinas refinadas.':'Chips de chocolate.','Avena y miel. Sin TACC':'Avena y miel.'};
  for(const [input,expected] of Object.entries(cases))assert.equal(stripPendingClaims(input),expected,input);
  const product=p('N173','Galletitas de arroz','Snacks',{precio:3000,descripcion:'Arroz yamaní tostado. Libre de gluten, sin T.A.C.C'});
  const page=productPageData(product);
  assert.equal(page.description,'Arroz yamaní tostado. Libre de gluten, sin T.A.C.C','visible sin cambios');
  assert.doesNotMatch(page.metaDescription,/t\.?a\.?c\.?c|gluten/i);assert.doesNotMatch(page.jsonLd.description,/t\.?a\.?c\.?c|gluten/i);
  assert.equal(page.jsonLd.description,'Arroz yamaní tostado.');
  const named=productPageData(p('N175','Copos sin azúcar','Cereales',{descripcion:'Sin T.A.C.C'}));
  assert.equal(named.jsonLd.description,undefined);assert.equal(named.jsonLd.name,'Copos sin azúcar');assert.equal(named.title,'Copos sin azúcar · 1 KG · Vitalia','el nombre visible y el título no cambian');assert.equal(named.metaDescription,'Copos (1 KG) a $1.000. Pedilo en Vitalia y coordiná la entrega por WhatsApp.');
  for(const product of fixtureCatalog()){const d=productPageData(product);const text=[stripPendingClaims(d.description),d.jsonLd.description||''].join(' ');assert.doesNotMatch(text,/t\.\s*a\.\s*c\.\s*c|gluten|sin az[uú]car/i,product.id);}
});
test('Meta de categoría: primera oración de la intro + "Pedidos por WhatsApp."',()=>{
  const data=categoryPageData([p('N1','A','Granolas y cereales')],'granolas-y-cereales');
  const first=categorias['Granolas y cereales'].intro.match(/^.*?[.!?](?=\s|$)/)[0];
  assert.equal(data.metaDescription,`${first} Pedidos por WhatsApp.`);assert.equal(data.intro,categorias['Granolas y cereales'].intro);
});
