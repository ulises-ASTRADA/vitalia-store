import {randomBytes} from 'node:crypto';
import {NextResponse} from 'next/server';

export function proxy(request) {
  // /categorias/Barritas → 308 a /categorias/barritas (los slugs son siempre en minúscula).
  const {pathname}=request.nextUrl;
  if(/^\/(categorias|productos)\//.test(pathname)&&pathname!==pathname.toLowerCase()){
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
// Las páginas de producto y categoría también llevan nonce: la política es la misma.
export const config={matcher:['/','/checkout','/boxes','/productos/:path*','/categorias/:path*']};
