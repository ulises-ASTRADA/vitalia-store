import {randomBytes} from 'node:crypto';
import {NextResponse} from 'next/server';

export const BARE_PRODUCT_ID=/^\/productos\/[A-Za-z]+\d+$/;

export function proxy(request) {
  // /categorias/Barritas → 308 a /categorias/barritas (los slugs son siempre en minúscula).
  const {pathname}=request.nextUrl;
  // Excepción: /productos/N001 (el código solo) no pasa por acá; la página redirige directo al slug
  // canónico en un único 308 (antes eran dos: N001 → n001 → slug).
  if(/^\/(categorias|productos)\//.test(pathname)&&pathname!==pathname.toLowerCase()&&!BARE_PRODUCT_ID.test(pathname)){
    const url=request.nextUrl.clone();url.pathname=pathname.toLowerCase();
    return NextResponse.redirect(url,308);
  }
  const nonce=randomBytes(24).toString('base64');
  const dev=process.env.NODE_ENV==='development';
  const csp=`default-src 'self'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev?" 'unsafe-eval'":''}; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; connect-src 'self'${dev?' ws:':''}; font-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`;
  const headers=new Headers(request.headers);
  headers.set('x-nonce',nonce);
  headers.set('Content-Security-Policy',csp);
  const response=NextResponse.next({request:{headers}});
  response.headers.set('Content-Security-Policy',csp);
  response.headers.set('Cache-Control','private, no-store');
  return response;
}
// Las páginas de producto, categoría y /envios también llevan nonce: la política es la misma.
export const config={matcher:['/','/checkout','/boxes','/productos/:path*','/categorias/:path*','/envios']};
