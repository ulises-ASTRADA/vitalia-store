import test from 'node:test';
import assert from 'node:assert/strict';
import {slugify,productSlug,productPath,findBySlug,NO_PRODUCT_PAGE} from '../lib/product-links.js';
import {cleanDescription,pricePerKilo,productPageData,relatedProducts,categoryList,categoryPageData,pageProducts,resolveProduct,assertNoPlaceholders,whatsappConsultUrl} from '../lib/product-pages.js';
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
test('N296 y N297 no tienen página ni link, pero siguen en la categoría',()=>{
  assert.deepEqual([...NO_PRODUCT_PAGE].sort(),['N296','N297']);
  const products=[p('N295','Aceite de oliva','Aceites y conservas'),p('N296','Producto A','Aceites y conservas'),p('N297','Producto B','Aceites y conservas')];
  assert.equal(productPath(products[1]),null);
  assert.equal(productPath(products[0]),'/productos/aceite-de-oliva-n295');
  assert.deepEqual(pageProducts(products).map(x=>x.id),['N295']);
  assert.equal(resolveProduct(products,'producto-a-n296'),null);
  assert.equal(categoryPageData(products,'aceites-y-conservas').items.length,3);
  assert.deepEqual(relatedProducts(products,products[0]),[]);
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
  const product=p('N037','Granola tradicional','Granolas y cereales',{precio:7700,descripcion:'Avena, arroz, copos de maíz, mix de semillas, miel, maní y coco'});
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
test('Intros sin marcadores ni productos excluidos',()=>{
  for(const [name,{intro}] of Object.entries(categorias)){
    assert.doesNotThrow(()=>assertNoPlaceholders(intro,name));
    assert.doesNotMatch(intro,/cbd|cannabi/i,name);
  }
});
test('Un marcador en los datos de la página corta el build',()=>{
  const product=p('N1','Granola [A COMPLETAR]','Granolas');
  assert.throws(()=>assertNoPlaceholders(productPageData(product),'/productos'),/A COMPLETAR/);
  assert.throws(()=>assertNoPlaceholders({intro:'Texto [A CONFIRMAR]'},'/categorias'),/A CONFIRMAR/);
});
