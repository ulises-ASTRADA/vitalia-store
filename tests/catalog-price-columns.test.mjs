import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeRows,parsePublicSheet} from '../lib/catalog.js';

// Encabezados reales de la planilla desde 2026-10-28.
const headers=['id','nombre','descripcion','categoria','precio_compra','presentacion','imagen','disponibilidad','activo','precio_venta_minorista','precio_venta_mayorista'];
const rows=[headers,
 ['N001','Pepas proteicas de almendra sabor banana','1 KG','Galletitas y panificados',16500,'1 KG','/images/product-001.webp','consultar',true,23100,21450],
 ['N004','Chalita de centeno','1 KG','Galletitas y panificados',5600,'1 KG','/images/product-004.webp','consultar',true,7839.999999999999,7280]];
const allowed=['id','nombre','descripcion','categoria','precio','presentacion','imagen','disponibilidad'];

test('Planilla nueva: el precio sale de precio_venta_minorista',()=>{
 const products=normalizeRows(rows);
 assert.equal(products[0].precio,23100);assert.equal(products[1].precio,7840);
});
test('Costo y mayorista nunca llegan al producto',()=>{
 const products=normalizeRows(rows),json=JSON.stringify(products);
 for(const p of products)assert.deepEqual(Object.keys(p).sort(),[...allowed].sort());
 assert(!/compra|mayorista/i.test(json));
 for(const leaked of ['16500','21450','5600','7280'])assert(!json.includes(leaked),leaked);
});
test('Sheets público con encabezados nuevos tampoco expone el costo',()=>{
 const fixture={status:'ok',table:{cols:headers.map(label=>({label})),rows:rows.slice(1).map(r=>({c:r.map(v=>({v}))}))}};
 const products=normalizeRows(parsePublicSheet('google.visualization.Query.setResponse('+JSON.stringify(fixture)+');'));
 assert.equal(products[0].precio,23100);assert(!JSON.stringify(products).includes('16500'));
});
test('Minorista tiene prioridad sobre precio si vuelven a convivir',()=>{
 const products=normalizeRows([['id','nombre','precio','activo','precio_venta_minorista'],['N001','Pepas',1,true,23100]]);
 assert.equal(products[0].precio,23100);
});
test('Columna precio sigue funcionando como respaldo',()=>{
 assert.equal(normalizeRows([['id','nombre','precio','activo'],['N001','Pepas',23100,true]])[0].precio,23100);
});
test('Sin columna de precio de venta falla con un mensaje claro, aunque esté precio_compra',()=>{
 for(const h of [['id','nombre','activo'],['id','nombre','activo','precio_compra','precio_venta_mayorista']])
  assert.throws(()=>normalizeRows([h,['N001','Pepas',true,16500,21450].slice(0,h.length)]),err=>err.message.includes('precio_venta_minorista')&&err.code==='UNAVAILABLE');
});
test('Fila sin precio minorista se rechaza, no cae al costo',()=>{
 assert.throws(()=>normalizeRows([headers,['N001','Pepas','','X',16500,'1 KG','','consultar',true,'',21450]]),{code:'CATALOG_INVALID'});
});
