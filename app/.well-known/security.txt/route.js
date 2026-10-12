export function GET() {
  const email=process.env.SECURITY_CONTACT_EMAIL||'hola@vitalia.energy';
  if(!email||!/^\S+@\S+\.\S+$/.test(email)||/[\r\n]/.test(email))return new Response('Security contact not configured.',{status:503,headers:{'Cache-Control':'no-store'}});
  const expires=new Date(Date.now()+180*86400000).toISOString();
  return new Response(`Contact: mailto:${email}\nExpires: ${expires}\nPreferred-Languages: es, en\nCanonical: https://www.vitalia.energy/.well-known/security.txt\n`,{headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'public, max-age=86400'}});
}
