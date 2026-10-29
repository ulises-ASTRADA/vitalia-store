import {createHash,randomInt,randomBytes} from 'node:crypto';
import {CODE_ALPHABET} from './code-format.js';
export {CODE_ALPHABET,normalizeCode} from './code-format.js';
export const CODE_TTL_DAYS=60;
export const CONSENT_TEXT='Acepto recibir novedades y promos de Vitalia por mail. Me puedo dar de baja cuando quiera.';
// 8 caracteres al azar (crypto) sin 0/O/1/I: 32^8 ≈ 1,1 billones de combinaciones.
export function generateCode() {
  let raw='';for(let i=0;i<8;i++)raw+=CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return `BV-${raw.slice(0,4)}-${raw.slice(4)}`;
}
export const newToken=()=>randomBytes(32).toString('hex');
export const isToken=value=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);
export const sha256=value=>createHash('sha256').update(value).digest('hex');

// Validación estricta pero práctica: local@dominio.tld, sin espacios ni caracteres de control.
export function normalizeEmail(value) {
  if(typeof value!=='string')return null;
  const email=value.trim().toLowerCase();
  if(email.length<6||email.length>254)return null;
  if(!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,24}$/.test(email))return null;
  if(email.includes('..')||email.startsWith('.')||email.split('@')[0].endsWith('.'))return null;
  return email;
}
export function cleanName(value) {
  if(typeof value!=='string'||value.length>80)return null;
  const name=value.replace(/[\x00-\x1f\x7f<>]/g,' ').replace(/\s+/g,' ').trim();
  return name?name:null;
}
