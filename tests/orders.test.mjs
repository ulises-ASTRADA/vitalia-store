import test from 'node:test';
import assert from 'node:assert/strict';
import { appendOrder, generateOrderId, estimateShippingCost } from '../lib/orders.js';

test('generateOrderId: genera prefijo VIT- con fecha y caracteres únicos', () => {
  const id1 = generateOrderId();
  const id2 = generateOrderId();
  assert.match(id1, /^VIT-\d{8}-[A-Z0-9]+$/);
  assert.notEqual(id1, id2);
});

test('estimateShippingCost: calcula costos por zona y envío gratis > $70.000', () => {
  assert.equal(estimateShippingCost('Villa Allende', 15000), 3000);
  assert.equal(estimateShippingCost('Mendiolaza', 20000), 3000);
  assert.equal(estimateShippingCost('El Talar (Mendiolaza)', 20000), 3000);
  assert.equal(estimateShippingCost('Río Ceballos', 25000), 5000);
  assert.equal(estimateShippingCost('Unquillo', 10000), 5000);
  assert.equal(estimateShippingCost('La Calera', 5000), 5000);
  assert.equal(estimateShippingCost('Villa Allende', 75000), 0);
  assert.equal(estimateShippingCost('Buenos Aires', 10000), null);
});

test('appendOrder: sin webhook ni service account devuelve orderId sin fallar', async () => {
  const prevWebhook = process.env.ORDERS_WEBHOOK_URL;
  const prevSheet = process.env.GOOGLE_ORDERS_SHEET_ID;
  delete process.env.ORDERS_WEBHOOK_URL;
  delete process.env.GOOGLE_ORDERS_SHEET_ID;

  try {
    const orderId = await appendOrder({
      name: 'Ana',
      locality: 'Villa Allende',
      province: 'Córdoba',
      notes: 'Sin azúcar',
      items: '2x Almendras (1 KG)',
      total: 10000,
      whatsappUrl: 'https://wa.me/549111'
    });
    assert.match(orderId, /^VIT-/);
  } finally {
    if (prevWebhook !== undefined) process.env.ORDERS_WEBHOOK_URL = prevWebhook;
    if (prevSheet !== undefined) process.env.GOOGLE_ORDERS_SHEET_ID = prevSheet;
  }
});

test('appendOrder: envía datos completos (precios, fechas, costo envío) al webhook', async () => {
  let capturedUrl = null;
  let capturedBody = null;
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, options) => {
    capturedUrl = String(url);
    capturedBody = JSON.parse(options.body);
    return new Response(JSON.stringify({ status: 'ok' }), { status: 200 });
  };

  process.env.ORDERS_WEBHOOK_URL = 'https://script.google.com/macros/s/test/exec';

  try {
    const orderId = await appendOrder({
      name: 'Carlos Test',
      locality: 'Mendiolaza',
      province: 'Córdoba',
      notes: 'Timbre 2B',
      items: '1x Mix Frutos Secos (500 G); 2x Miel (500 G)',
      total: 8500,
      status: 'Pendiente',
      whatsappUrl: 'https://wa.me/549351?text=pedido'
    });

    assert.equal(capturedUrl, 'https://script.google.com/macros/s/test/exec');
    assert.equal(capturedBody.name, 'Carlos Test');
    assert.equal(capturedBody.locality, 'Mendiolaza');
    assert.equal(capturedBody.province, 'Córdoba');
    assert.equal(capturedBody.notes, 'Timbre 2B');
    assert.equal(capturedBody.items, '1x Mix Frutos Secos (500 G); 2x Miel (500 G)');
    assert.equal(capturedBody.precio_pedido, 8500);
    assert.equal(capturedBody.costo_envio, 3000); // 3000 por Mendiolaza
    assert.equal(capturedBody.total, 11500); // 8500 + 3000
    assert.equal(capturedBody.status, 'Pendiente');
    assert.equal(capturedBody.fecha_entrega, 'A coordinar');
    assert.equal(capturedBody.orderId, orderId);
    assert.ok(capturedBody.fecha_pedido);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.ORDERS_WEBHOOK_URL;
  }
});
