import NextLink from 'next/link';
import {INSTAGRAM_URL,INSTAGRAM_HANDLE} from '../lib/social';
const Link=NextLink.default||NextLink;

// Footer único (home, producto, categoría, boxes): WhatsApp e Instagram con tap target de 44px en mobile.
export default function SiteFooter({whatsappUrl}) {
  return <footer className="footer"><Link href="/" className="footer-brand">Vitalia</Link><p>Elegí. Sumá. Conversemos.</p>{whatsappUrl&&<span><a href={whatsappUrl} rel="noopener">Pedidos por WhatsApp</a></span>}<a className="footer-social" href={INSTAGRAM_URL} rel="noopener">Instagram {INSTAGRAM_HANDLE}</a></footer>;
}
