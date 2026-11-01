import test from 'node:test';
import assert from 'node:assert/strict';
import { appendOrder, generateOrderId } from '../lib/orders.js';

test('generateOrderId: genera prefijo ORD- y caracteres en mayúscula', () => {
  const id = generateOrderId();
  assert.match(id, /^ORD-[A-Z0-9]+-[A-Z0-9]+$/);
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
    assert.match(orderId, /^ORD-/);
  } finally {
    if (prevWebhook !== undefined) process.env.ORDERS_WEBHOOK_URL = prevWebhook;
    if (prevSheet !== undefined) process.env.GOOGLE_ORDERS_SHEET_ID = prevSheet;
  }
});

test('appendOrder: envía datos correctamente al webhook cuando ORDERS_WEBHOOK_URL está configurado', async () => {
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
    assert.equal(capturedBody.total, 8500);
    assert.equal(capturedBody.status, 'Pendiente');
    assert.equal(capturedBody.orderId, orderId);
    assert.ok(capturedBody.fecha);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.ORDERS_WEBHOOK_URL;
  }
});
