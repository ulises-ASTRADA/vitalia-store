// Formato del código de bienvenida: BV-XXXX-XXXX sin 0/O/1/I. Sin dependencias de Node: lo usa también el carrito.
export const CODE_ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function normalizeCode(value) {
  if(typeof value!=='string'||value.length>40)return null;
  const raw=value.toUpperCase().replace(/[\s-]/g,'');
  const body=raw.startsWith('BV')?raw.slice(2):raw;
  if(body.length!==8||[...body].some(c=>!CODE_ALPHABET.includes(c)))return null;
  return `BV-${body.slice(0,4)}-${body.slice(4)}`;
}
