import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createSign } from 'node:crypto';

let tokenCache, catalogCache, tokenFlight, catalogFlight;
export class StoreError extends Error {
  constructor(message, status = 503, code = 'UNAVAILABLE') { super(message); this.status = status; this.code = code; }
}
const truthy = value => value === true || ['true','verdadero','sí','si','1'].includes(String(value).trim().toLowerCase());
const field = value => String(value ?? '').trim();

// La planilla puede traer precio_compra (costo) y precio_venta_mayorista: quedan fuera.
export const RETAIL_PRICE_COLUMNS = ['precio_venta_minorista','precio'];
const READ_COLUMNS = ['id','nombre','descripcion','categoria','presentacion','imagen','disponibilidad','activo',...RETAIL_PRICE_COLUMNS];

export function normalizeRows(rows) {
  if (!Array.isArray(rows) || !rows.length) throw new StoreError('El catálogo está vacío.');
  const headers = rows[0].map(x => field(x).toLowerCase());
  for (const key of ['id','nombre','activo']) {
    if (!headers.includes(key)) throw new StoreError(`Falta la columna ${key} en el catálogo.`);
  }
  // Precio de venta al público. Las columnas de costo y mayorista nunca se leen.
  const priceColumn = RETAIL_PRICE_COLUMNS.find(key => headers.includes(key));
  if (!priceColumn) throw new StoreError(`Falta la columna de precio en el catálogo: se espera ${RETAIL_PRICE_COLUMNS[0]} (o precio).`);
  const seen = new Set();
  return rows.slice(1).filter(row => row.some(x => field(x))).flatMap((row, i) => {
    const source = Object.fromEntries(headers.flatMap((h,j) => READ_COLUMNS.includes(h) ? [[h,row[j]]] : []));
    const rawPrice = source[priceColumn];
    if (!truthy(source.activo)) return [];
    const id = field(source.id);
    const price = typeof rawPrice === 'number' ? rawPrice : Number(field(rawPrice));
    if (!/^[A-Za-z0-9_-]{1,60}$/.test(id) || seen.has(id) || !field(source.nombre) || !field(rawPrice) || !Number.isFinite(price) || price <= 0 || price > 1e9) {
      throw new StoreError(`Revisá el identificador, nombre o precio de la fila ${i+2}.`, 503, 'CATALOG_INVALID');
    }
    seen.add(id);
    // La planilla también usa 0 para indicar productos sin disponibilidad.
    const rawAvailability = field(source.disponibilidad).toLowerCase();
    const availability = rawAvailability === '0' ? 'agotado' : rawAvailability || 'consultar';
    if (!['consultar','disponible','agotado'].includes(availability)) throw new StoreError(`Revisá la disponibilidad de la fila ${i+2}.`);
    let image = field(source.imagen);
    if (!/^\/images\/[a-zA-Z0-9._-]+$/.test(image) && !/^https:\/\//.test(image)) image = '';
    return [{id, nombre:field(source.nombre), descripcion:field(source.descripcion), categoria:field(source.categoria)||'Almacén', precio: Math.round(price*100)/100, presentacion:field(source.presentacion), imagen:image, disponibilidad:availability}];
  });
}

export function storeSettings() {
  const currency = process.env.STORE_CURRENCY || 'ARS';
  if (!/^[A-Z]{3}$/.test(currency)) throw new StoreError('Moneda no configurada.');
  const phone = (process.env.WHATSAPP_NUMBER || '').replace(/[+\s()-]/g,'');
  const isPreview = process.env.PREVIEW_MODE === 'true' || (!process.env.GOOGLE_SHEETS_ID && process.env.VERCEL_ENV !== 'production');
  const testCheckout=process.env.VERCEL_ENV!=='production'&&process.env.ALLOW_TEST_CHECKOUT==='true';
  return { name:process.env.STORE_NAME || 'Vitalia', currency, phone, isPreview, testCheckout, checkoutEnabled:(testCheckout||(!isPreview&&Boolean(process.env.GOOGLE_SHEETS_ID))) && /^[1-9]\d{7,14}$/.test(phone) };
}

async function accessToken() {
  if (tokenCache && tokenCache.until > Date.now()) return tokenCache.value;
  if (tokenFlight) return tokenFlight;
  tokenFlight = (async () => {
    let account;
    try { account = process.env.GOOGLE_SERVICE_ACCOUNT_JSON ? JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON) : {}; }
    catch { throw new StoreError('Credenciales del catálogo no configuradas.'); }
    const email = account.client_email || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const key = (account.private_key || process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g,'\n');
    if (!email || !key) throw new StoreError('El catálogo todavía no está conectado.');
    const now = Math.floor(Date.now()/1000);
    const b64 = x => Buffer.from(JSON.stringify(x)).toString('base64url');
    const unsigned = `${b64({alg:'RS256',typ:'JWT'})}.${b64({iss:email,scope:'https://www.googleapis.com/auth/spreadsheets.readonly',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600})}`;
    const signature = createSign('RSA-SHA256').update(unsigned).sign(key,'base64url');
    const response = await fetch('https://oauth2.googleapis.com/token', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:`${unsigned}.${signature}`}), signal:AbortSignal.timeout(8000) });
    if (!response.ok) throw new StoreError('No pudimos conectar con el catálogo.');
    const data = await response.json();
    if (!data.access_token) throw new StoreError('No pudimos conectar con el catálogo.');
    tokenCache = {value:data.access_token,until:Date.now()+(Number(data.expires_in||3600)-120)*1000};
    return tokenCache.value;
  })();
  try { return await tokenFlight; } finally { tokenFlight=undefined; }
}

export async function getCatalog({fresh=false}={}) {
  const settings = storeSettings();
  if (settings.isPreview) {
    const raw = JSON.parse(await readFile(join(process.cwd(),'data','catalog.json'),'utf8'));
    const headers = Object.keys(raw[0]);
    return {products:normalizeRows([headers,...raw.map(p=>headers.map(h=>p[h]))]), source:'pdf', sourceDate:'2026-10-03'};
  }
  if (!process.env.GOOGLE_SHEETS_ID) throw new StoreError('El catálogo todavía no está conectado.');
  if (!fresh && catalogCache && catalogCache.until > Date.now()) return catalogCache.value;
  if (!fresh && catalogFlight) return catalogFlight;
  const retrieve = async () => {
    if (process.env.GOOGLE_SHEETS_PUBLIC === 'true') {
      const url = new URL(`https://docs.google.com/spreadsheets/d/${encodeURIComponent(process.env.GOOGLE_SHEETS_ID)}/gviz/tq`);
      url.searchParams.set('tqx', 'out:json');
      url.searchParams.set('headers', '1');
      url.searchParams.set('sheet', process.env.GOOGLE_SHEETS_TAB || 'Productos');
      const response = await fetch(url, { signal:AbortSignal.timeout(10000), cache:'no-store' });
      if (!response.ok) throw new StoreError('No pudimos leer el catálogo público. Revisá los permisos de la planilla.');
      const value = {products:normalizeRows(parsePublicSheet(await response.text())), source:'sheets', updatedAt:new Date().toISOString()};
      catalogCache = {value,until:Date.now()+60000};
      return value;
    }
    const token = await accessToken();
    const id = encodeURIComponent(process.env.GOOGLE_SHEETS_ID);
    const range = encodeURIComponent(process.env.GOOGLE_SHEETS_RANGE || 'Productos!A1:L5000');
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${range}?valueRenderOption=UNFORMATTED_VALUE`, { headers:{Authorization:`Bearer ${token}`}, signal:AbortSignal.timeout(10000) });
    if (!response.ok) throw new StoreError('No pudimos actualizar el catálogo. Intentá nuevamente en unos minutos.');
    const data = await response.json();
    const value = {products:normalizeRows(data.values || []), source:'sheets', updatedAt:new Date().toISOString()};
    catalogCache = {value,until:Date.now()+60000};
    return value;
  };
  if (fresh) return retrieve();
  catalogFlight = retrieve();
  try { return await catalogFlight; } finally {catalogFlight=undefined;}
}

export function publicSettings() {
  const {name,currency,isPreview,testCheckout,checkoutEnabled} = storeSettings();
  return {name,currency,isPreview,testCheckout,checkoutEnabled};
}

export function parsePublicSheet(text) {
  const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?\s*$/);
  if (!match) throw new StoreError('El catálogo público no está disponible. Revisá los permisos de la planilla.');
  let data;
  try { data = JSON.parse(match[1]); } catch { throw new StoreError('Respuesta del catálogo público inválida.'); }
  if (data.status !== 'ok' || !Array.isArray(data.table?.cols) || !Array.isArray(data.table?.rows)) throw new StoreError('No pudimos leer el catálogo público.');
  return [data.table.cols.map(c => c.label), ...data.table.rows.map(r => data.table.cols.map((_, i) => r.c?.[i]?.v ?? ''))];
}
