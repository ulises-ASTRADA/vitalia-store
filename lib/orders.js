import { storeSettings } from './catalog.js';

const SHEET_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const TAB = process.env.GOOGLE_ORDERS_TAB || 'Pedidos';
const SHEET_ID = process.env.GOOGLE_SHEETS_ID || process.env.GOOGLE_ORDERS_SHEET_ID;

let tokenCache, tokenFlight;
async function accessToken() {
  if (tokenCache && tokenCache.until > Date.now()) return tokenCache.value;
  if (tokenFlight) return tokenFlight;
  tokenFlight = (async () => {
    const { createSign } = await import('node:crypto');
    const { readFile } = await import('node:fs/promises');
    const { join } = await import('node:path');
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

export async function appendOrder({ name, locality, province, notes, items, total, whatsappUrl }) {
  if (!SHEET_ID) return;
  const token = await accessToken();
  const id = encodeURIComponent(SHEET_ID);
  const tab = encodeURIComponent(TAB);
  const row = [
    new Date().toISOString(),
    `ORD-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`,
    sanitize(name),
    sanitize(locality),
    sanitize(province),
    sanitize(notes),
    Number(total).toFixed(2),
    sanitize(Array.isArray(items) ? items.map(i => `${i.quantity}x ${sanitize(i.product?.nombre || i.id)}`).join('; ') : ''),
    sanitize(whatsappUrl || '')
  ];
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${id}:append?insertDataOption=INSERT_ROWS&valueInputOption=USER_ENTERED&includeValuesInResponse=false`;
  const response = await fetch(url, {
    method:'POST',
    headers:{'Authorization':`Bearer ${token}`, 'Content-Type':'application/json'},
    body: JSON.stringify({range:`${tab}!A:I`, values:[row]}),
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`No pudimos guardar el pedido en la planilla.`);
  }
  return row[1];
}
