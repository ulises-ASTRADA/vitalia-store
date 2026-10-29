import test from 'node:test';
import assert from 'node:assert/strict';
import {BULK_DISCOUNT_FROM,BULK_DISCOUNT_LABEL,FREE_SHIPPING_FROM,computeTotals,nextGoal} from '../lib/promos.js';
import {makeOrder} from '../lib/checkout.js';

const settings={name:'Vitalia',currency:'ARS',phone:'5491100000000',testCheckout:false};
const order=(precio,quantity=1)=>{const products=[{id:'A',nombre:'Granola',precio,presentacion:'1 KG',disponibilidad:'disponible'}];return [{items:[{id:'A',quantity,expectedPrice:precio}],name:'Prueba',locality:'Córdoba',province:'Córdoba',notes:''},products];};

test('Umbrales salen de una sola config: $70.000 y $400.000',()=>{
  assert.equal(FREE_SHIPPING_FROM,70000);assert.equal(BULK_DISCOUNT_FROM,400000);
  assert.equal(BULK_DISCOUNT_LABEL,'Descuento por compra desde $400.000 (10%)');
});
test('Exactamente $400.000 aplica el 10% automático',()=>{
  const t=computeTotals({grossCents:40000000});
  assert.equal(t.bulkCents,4000000);assert.equal(t.codeCents,0);assert.equal(t.totalCents,36000000);
});
test('$399.999 no aplica el 10% automático',()=>{
  const t=computeTotals({grossCents:39999900});
  assert.equal(t.bulkCents,0);assert.equal(t.totalCents,39999900);
});
test('Código + umbral = 20% plano sobre el subtotal, no compuesto',()=>{
  const t=computeTotals({grossCents:41370000,hasCode:true});
  assert.equal(t.bulkCents,4137000);assert.equal(t.codeCents,4137000);
  assert.equal(t.totalCents,33096000);// 80% de 413.700, no 81% (compuesto daría 335.097)
  assert.equal(t.savingsCents,8274000);
});
test('Solo código por debajo del umbral: 10%',()=>{
  const t=computeTotals({grossCents:5000000,hasCode:true});
  assert.equal(t.codeCents,500000);assert.equal(t.bulkCents,0);assert.equal(t.totalCents,4500000);
});
test('El envío nunca se descuenta y es gratis desde $70.000 del subtotal de productos (antes de descuentos)',()=>{
  assert.equal(computeTotals({grossCents:7000000}).freeShipping,true);
  assert.equal(computeTotals({grossCents:6999900}).freeShipping,false);
  // $75.000 con código queda en $67.500 de total, pero el envío sigue gratis: se mide sobre el subtotal bruto.
  const t=computeTotals({grossCents:7500000,hasCode:true});
  assert.equal(t.freeShipping,true);assert.equal(t.totalCents,6750000);
  // Los descuentos se calculan solo sobre productos: no hay ningún monto de envío en el total.
  assert.equal(t.totalCents,t.grossCents-t.codeCents);
});
test('Sugerencias se suman como línea aparte y no cambian la base de los umbrales',()=>{
  const t=computeTotals({grossCents:40000000,suggestionCents:100000,hasCode:true});
  assert.equal(t.bulkCents,4000000);assert.equal(t.codeCents,4000000);assert.equal(t.totalCents,31900000);
});
test('Montos inválidos se rechazan',()=>{
  assert.throws(()=>computeTotals({grossCents:-1}));assert.throws(()=>computeTotals({grossCents:1.5}));
});
test('Meta del carrito: envío, después 10% y después listo',()=>{
  assert.deepEqual({...nextGoal(5000000),progress:undefined},{kind:'shipping',missingCents:2000000,progress:undefined});
  assert.equal(nextGoal(7000000).kind,'bulk');assert.equal(nextGoal(7000000).missingCents,33000000);
  assert.equal(nextGoal(40000000).kind,'done');
});
test('Pedido en el servidor: $400.000 exactos con código, envío gratis y mensaje con código y número',()=>{
  const [body,products]=order(100000,4);
  const result=makeOrder(body,products,settings,{orderRef:'V-0007',code:'BV-7K2Q-9MXD'});
  assert.equal(result.subtotal,400000);assert.equal(result.bulkDiscount,40000);assert.equal(result.codeDiscount,40000);assert.equal(result.total,320000);assert.equal(result.freeShipping,true);
  assert.match(result.message,/^Hola Vitalia! Quiero hacer este pedido:\nPedido #V-0007\n/);
  assert.match(result.message,/\nDescuento por compra desde \$400\.000 \(10%\): -\$40\.000,00\n/);
  assert.match(result.message,/\nCodigo de bienvenida BV-7K2Q-9MXD \(10%\): -\$40\.000,00\n/);
  assert.match(result.message,/\nEnvio: Gratis\nTotal: \$320\.000,00\n/);
  assert.ok(!/\p{Extended_Pictographic}|\uFE0F/u.test(result.message));
});
test('Pedido de $399.999 sin código: sin descuento automático',()=>{
  const [body,products]=order(399999);
  const result=makeOrder(body,products,settings,{orderRef:'V-0008'});
  assert.equal(result.bulkDiscount,0);assert.equal(result.total,399999);assert.doesNotMatch(result.message,/Descuento por compra/);
});
