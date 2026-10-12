import './globals.css';
import Provider from '../components/provider';
import {headers} from 'next/headers';
export const metadata = {
  title: 'Vitalia · Dietética',
  description: 'Explorá el catálogo de Vitalia. Armá tu carrito y coordiná tu pedido por WhatsApp.',
  robots: { index: false, follow: false },
  icons: { icon: '/images/favicon.webp' }
};
export default async function RootLayout({ children }) {
  const nonce=(await headers()).get('x-nonce')||undefined;
  return <html lang="es-AR" suppressHydrationWarning><body><Provider nonce={nonce}>{children}</Provider></body></html>;
}
