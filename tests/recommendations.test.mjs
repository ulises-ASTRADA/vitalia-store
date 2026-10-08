import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getRecommendations,getQuantitySuggestion} from '../lib/recommendations.js';
const product=(id,categoria,other={})=>({id,categoria,precio:100,activo:true,disponibilidad:'consultar',...other});
test('Cross-sale solo ofrece complementos activos fuera del carrito, no agotados',()=>{
 const a=product('a','Infusiones');
 const products=[a,product('b','Galletitas y panificados',{activo:false}),product('c','Galletitas y panificados',{disponibilidad:'agotado'}),product('d','Galletitas y panificados'),product('e','Alfajores y chocolates')];
 assert.deepEqual(getRecommendations(products,[{product:a,quantity:1}]).map(p=>p.id),['d','e']);
 assert.deepEqual(getRecommendations(products,[{product:a,quantity:1},{product:products[3],quantity:1}]).map(p=>p.id),['e']);
 assert.deepEqual(getRecommendations(products,[]),[]);
 assert.deepEqual(getRecommendations(products,Array(50).fill({product:a,quantity:1})),[]);
});
test('Cantidad adicional respeta 99 y nunca inventa descuentos ni paquetes',()=>{
 const a=product('a','Infusiones');
 assert.equal(getQuantitySuggestion([{product:a,quantity:98}]).product,a);
 assert.equal(getQuantitySuggestion([{product:a,quantity:99}]),null);
 assert.equal(getQuantitySuggestion([]),null);
});
