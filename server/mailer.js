// Mail del código de bienvenida. RESEND_API_KEY es solo del servidor y nunca se imprime.
// Sin clave real: en local se usa un mailer de prueba que escribe el mail en la consola; en Vercel falla cerrado.
import {isRealSecret} from './growth-store.js';
import {sha256} from '../lib/welcome-code.js';
import {SITE_URL} from '../lib/seo.js';

const siteUrl=()=>(process.env.SITE_URL||SITE_URL).replace(/\/$/,'');
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function welcomeEmail({name,code,unsubUrl}) {
  const html=`<!doctype html><html lang="es"><body style="margin:0;background:#f4f5f0;font-family:Arial,Helvetica,sans-serif;color:#22362a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:14px">
<tr><td style="padding:30px 30px 8px"><div style="font-size:12px;letter-spacing:1.4px;font-weight:700;color:#62695e">VITALIA · DIETÉTICA</div>
<h1 style="margin:12px 0 10px;font-size:24px;line-height:30px">¡Hola, ${escape(name)}! Acá está tu 10% off</h1>
<p style="margin:0 0 18px;font-size:15px;line-height:23px">Cargalo en el carrito, en «¿Tenés un código de descuento?». Es de un solo uso y vence en 60 días.</p>
<div style="display:inline-block;background:#e3ed92;color:#233a29;font-size:22px;font-weight:700;letter-spacing:2px;padding:12px 20px;border-radius:10px">${escape(code)}</div>
<p style="margin:18px 0 0;font-size:13px;line-height:20px;color:#62695e">Se suma a las otras promos: desde $400.000, 10% off en todo el carrito. Los descuentos aplican solo a productos, no al envío.</p>
<p style="margin:22px 0 0"><a href="${escape(siteUrl())}" style="display:inline-block;background:#233a29;color:#ffffff;font-weight:700;text-decoration:none;padding:13px 24px;border-radius:8px;font-size:15px">Ir a la tienda</a></p></td></tr>
<tr><td style="padding:22px 30px 26px;font-size:12px;line-height:18px;color:#62695e">Recibís este mail porque te sumaste en vitalia.energy. <a href="${escape(unsubUrl)}" style="color:#62695e">Darme de baja</a></td></tr>
</table></td></tr></table></body></html>`;
  const text=`¡Hola, ${name}! Acá está tu 10% off en Vitalia.\n\nTu código: ${code}\n\nCargalo en el carrito, en «¿Tenés un código de descuento?». Es de un solo uso y vence en 60 días.\n\n${siteUrl()}\n\nDarme de baja: ${unsubUrl}`;
  return {subject:'Tu código de 10% off en Vitalia',html,text};
}

export async function sendWelcomeEmail({to,name,code,unsubToken}) {
  const unsubUrl=`${siteUrl()}/api/welcome/unsubscribe?t=${unsubToken}`;
  const {subject,html,text}=welcomeEmail({name,code,unsubUrl});
  const key=process.env.RESEND_API_KEY;
  if(!isRealSecret(key)) {
    if(process.env.VERCEL==='1'){console.error('welcome mail not configured');return false;}
    console.log(`[mailer de prueba] Mail NO enviado (sin RESEND_API_KEY real).\nPara: ${to}\nAsunto: ${subject}\n\n${text}\n[fin del mail de prueba]`);
    return true;
  }
  try{
    const response=await fetch('https://api.resend.com/emails',{method:'POST',cache:'no-store',signal:AbortSignal.timeout(8000),
      headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':sha256(unsubToken)},
      body:JSON.stringify({from:process.env.RESEND_FROM||'Vitalia <hola@vitalia.energy>',to:[to],reply_to:process.env.RESEND_REPLY_TO||'hola@vitalia.energy',subject,html,text,
        headers:{'List-Unsubscribe':`<${unsubUrl}>`,'List-Unsubscribe-Post':'List-Unsubscribe=One-Click'}})});
    if(!response.ok)console.error('resend send failed',response.status); // solo el estado, sin datos personales
    return response.ok;
  }catch{console.error('resend send error');return false;}
}
