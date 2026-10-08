import test from 'node:test';
import assert from 'node:assert/strict';
import {offerPrice,priceCart} from '../lib/cart-offers.js';
import {makeOrder} from '../lib/checkout.js';

const products=[
  {id:'tea',nombre:'Té',categoria:'Infusiones',precio:150,disponibilidad:'consultar'},
  {id:'cookies',nombre:'Cookies',categoria:'Galletitas y panificados',precio:200,disponibilidad:'consultar'},
  {id:'oil',nombre:'Aceite',categoria:'Aceites y conservas',precio:100,disponibilidad:'consultar'}
];
const settings={name:'Vitalia',currency:'ARS',phone:'5493512136078',testCheckout:true};
const order=()=>({name:'Prueba',locality:'Córdoba',province:'Córdoba',notes:'',items:[{id:'tea',quantity:1,expectedPrice:150},{id:'cookies',quantity:2,expectedPrice:200,offerSourceId:'tea'}]});

test('Descuento real del 10% en una unidad: redondeo, total y mensaje de prueba',()=>{
  assert.equal(offerPrice(11.11),10);
  const result=makeOrder(order(),products,settings);
  assert.equal(result.total,530);assert.equal(result.savings,20);
  assert.match(result.message,/10% en una presentación/);assert.match(result.message,/Ahorro por sugerencias: \$20,00/);
  assert.match(result.message,/PEDIDO DE PRUEBA/);
  assert.equal(products[1].precio,200);
  assert.equal(priceCart([{product:products[0],quantity:1},{product:products[1],quantity:2}],{cookies:'tea'})[1].subtotal,380);
});
test('No descuenta compras normales; invalida ofertas sin acompañante o con categorías ajenas',()=>{
  const body=order();delete body.items[1].offerSourceId;
  assert.equal(makeOrder(body,products,settings).total,550);
  for(const source of ['missing','cookies','oil','']){
    const invalid=order();invalid.items[1].offerSourceId=source;
    assert.throws(()=>makeOrder(invalid,products,settings),e=>e.status===409);
  }
  const invalid=order();invalid.items.shift();assert.throws(()=>makeOrder(invalid,products,settings),e=>e.status===409);
  assert.equal(priceCart([{product:products[1],quantity:2}],{cookies:'tea'})[0].savings,0);
});
test('Rechaza ciclos de ofertas, fuente inactiva, precios manipulados y metadatos inválidos',()=>{
  const cycle=order();cycle.items[0].offerSourceId='cookies';assert.throws(()=>makeOrder(cycle,products,settings),e=>e.status===409);
  assert.throws(()=>makeOrder(order(),[{...products[0],activo:false},products[1]],settings),e=>e.status===409);
  const invalid=order();invalid.items[1].expectedPrice=180;assert.throws(()=>makeOrder(invalid,products,settings),e=>e.status===409);
  invalid.items[1].expectedPrice=200;invalid.items[1].offerSourceId=123;assert.throws(()=>makeOrder(invalid,products,settings),e=>e.status===400);
});
