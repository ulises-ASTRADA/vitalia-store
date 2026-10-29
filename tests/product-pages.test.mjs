import test from 'node:test';
import assert from 'node:assert/strict';
import {slugify,productSlug,productPath,findBySlug} from '../lib/product-links.js';
import * as productLinks from '../lib/product-links.js';
import localCatalog from '../data/catalog.json' with {type:'json'};
import {cleanDescription,pricePerKilo,productPageData,relatedProducts,categoryList,categoryPageData,pageProducts,resolveProduct,assertNoPlaceholders,whatsappConsultUrl,offerAvailability} from '../lib/product-pages.js';
import categorias from '../data/categorias.json' with {type:'json'};
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
  assert.equal(page.metaDescription,'Aceite de CBD al 40% — uso oral (20 ml) a $\u00a09.100,00. Pedilo en Vitalia y coordiná la entrega por WhatsApp.');
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
  assert.match(page.metaDescription,/^Granola tradicional \(1 KG\) a \$\s7\.700,00\. Avena, .* Pedilo en Vitalia y coordiná la entrega por WhatsApp\.$/);
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
