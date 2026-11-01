import { storeSettings } from './catalog.js';

const SHEET_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const TAB = process.env.GOOGLE_ORDERS_TAB || 'Pedidos';

let tokenCache, tokenFlight;
async function accessToken() {
  if (tokenCache && tokenCache.until > Date.now()) return tokenCache.value;
  if (tokenFlight) return tokenFlight;
  tokenFlight = (async () => {
    const { createSign } = await import('node:crypto');
    let account;
    try { account = process.env.GOOGLE_SERVICE_ACCOUNT_JSON ? JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON) : {}; }
    catch { throw new Error('Credenciales del sheet no configuradas.'); }
    const email = account.client_email || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const key = (account.private_key || process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g,'\n');
    if (!email || !key) throw new Error('El sheet todavía no está conectado.');
    const now = Math.floor(Date.now()/1000);
    const b64 = x => Buffer.from(JSON.stringify(x)).toString('base64url');
    const unsigned = `${b64({alg:'RS256',typ:'JWT'})}.${b64({iss:email,scope:SHEET_SCOPE,aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600})}`;
    const signature = createSign('RSA-SHA256').update(unsigned).sign(key,'base64url');
    const response = await fetch('https://oauth2.googleapis.com/token', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:`${unsigned}.${signature}`}), signal:AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error('No pudimos conectar con Google Sheets.');
    const data = await response.json();
    if (!data.access_token) throw new Error('No pudimos conectar con Google Sheets.');
    tokenCache = {value:data.access_token,until:Date.now()+(Number(data.expires_in||3600)-120)*1000};
    return tokenCache.value;
  })();
  try { return await tokenFlight; } finally { tokenFlight=undefined; }
}

function sanitize(value) {
  return String(value ?? '').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g,' ').trim();
}

export function generateOrderId() {
  return `ORD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
}

export async function appendOrder({ name, locality, province, notes, items, total, whatsappUrl, status = 'Pendiente' }) {
  const orderId = generateOrderId();
  const fecha = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Cordoba' });
  const itemsText = Array.isArray(items)
    ? items.map(i => `${i.quantity}x ${sanitize(i.product?.nombre || i.id)}${i.product?.presentacion ? ` (${sanitize(i.product.presentacion)})` : ''}`).join('; ')
    : sanitize(items);

  const payload = {
    fecha,
    orderId,
    name: sanitize(name),
    locality: sanitize(locality),
    province: sanitize(province),
    notes: sanitize(notes),
    total: Number(total) || 0,
    items: itemsText,
    status: sanitize(status) || 'Pendiente',
    whatsappUrl: sanitize(whatsappUrl || '')
  };

  const webhookUrl = process.env.ORDERS_WEBHOOK_URL || process.env.GOOGLE_ORDERS_WEBHOOK_URL;
  if (webhookUrl) {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) {
      throw new Error(`Webhook de pedidos respondió con status ${res.status}`);
    }
    return orderId;
  }

  const sheetId = process.env.GOOGLE_ORDERS_SHEET_ID;
  if (sheetId && (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_JSON)) {
    const token = await accessToken();
    const id = encodeURIComponent(sheetId);
    const tab = encodeURIComponent(TAB);
    const row = [
      payload.fecha,
      payload.orderId,
      payload.name,
      payload.locality,
      payload.province,
      payload.notes,
      payload.total.toFixed(2),
      payload.items,
      payload.status,
      payload.whatsappUrl
    ];
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${id}:append?insertDataOption=INSERT_ROWS&valueInputOption=USER_ENTERED&includeValuesInResponse=false`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ range: `${tab}!A:J`, values: [row] }),
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) {
      throw new Error(`No pudimos guardar el pedido en la planilla.`);
    }
    return orderId;
  }

  return orderId;
}
