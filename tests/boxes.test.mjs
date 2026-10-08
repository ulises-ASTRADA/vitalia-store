import test from 'node:test';
import assert from 'node:assert/strict';
import {buildBox} from '../lib/boxes.js';
const product=(id,nombre,categoria,precio,extra={})=>({id,nombre,categoria,precio,presentacion:'500 GR',disponibilidad:'consultar',...extra});
const products=[
  product('granola','Granola tradicional','Granolas y cereales',100,{descripcion:'Avena, miel y maní'}),
  product('oats','Avena fina','Granolas y cereales',80),
  product('nuts','Almendras','Frutos secos y semillas',120),
  product('seeds','Semilla de chía','Frutos secos y semillas',90),
  product('peanut','Pasta de maní','Untables y dulces',130),
  product('tea','Té verde','Infusiones',70),
  product('bars','Barrita de chocolate','Barritas',140),
  product('snack','Maíz frito salado','Snacks',110),
  product('protein','Pepas proteicas','Galletitas y panificados',160)
];
test('Boxes usan presentaciones reales, variedad sin duplicados y precios intactos',()=>{
  const snapshot=JSON.stringify(products);
  for(const goal of ['breakfast','work','energy']){
    const result=buildBox(products,{goal});
    assert(result.products.length>=4);assert.equal(new Set(result.products.map(p=>p.id)).size,result.products.length);
    assert.equal(result.total,result.products.reduce((sum,p)=>sum+p.precio,0));
  }
  assert.equal(buildBox(products,{goal:'breakfast'}).products.length,6);
  assert.equal(JSON.stringify(products),snapshot);
});
test('Presupuesto máximo y preferencias: no inventa presentaciones ni descuentos',()=>{
  const box=buildBox(products,{goal:'work',budget:250});assert(box.total<=250);assert(box.products.length>0);
  assert.equal(buildBox(products,{budget:1}).products.length,0);
  assert.equal(buildBox(products,{budget:0}).products.length,0);
  assert.equal(buildBox(products,{budget:NaN}).products.length,0);
  assert(!buildBox(products,{goal:'work',taste:'sweet'}).products.some(p=>p.id==='snack'));
  assert(!buildBox(products,{goal:'work',taste:'salty'}).products.some(p=>p.id==='bars'));
  const excluded=buildBox(products,{avoid:'MANÍ, chía'}).products.map(p=>p.id);
  for(const id of ['granola','peanut','seeds'])assert(!excluded.includes(id));
});
test('Inactivos, agotados, sin presentación y precios inválidos nunca entran al box',()=>{
  const unavailable=products.map((p,i)=>({...p,...(i%4===0?{activo:false}:i%4===1?{disponibilidad:'agotado'}:i%4===2?{presentacion:''}:{precio:NaN})}));
  assert.equal(buildBox(unavailable).products.length,0);
  assert.equal(buildBox(products,{goal:'gift',profile:'work'}).definition.id,'work');
});
test('Frutos secos se distinguen de mixes de semillas y panificados con almendra',()=>{
  const candidates=[product('mix','Mix de semillas','Frutos secos y semillas',10),product('cookie','Cookie de almendra','Galletitas y panificados',20),product('mani','Maní sin sal','Frutos secos y semillas',30)];
  assert.deepEqual(buildBox(candidates,{goal:'work'}).products.map(p=>p.id),['mani']);
});
