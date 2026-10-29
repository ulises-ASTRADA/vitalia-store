import './globals.css';
import './fase1.css';
import './growth.css';
import Provider from '../components/provider';
import WelcomePopup from '../components/welcome-popup';
import {headers} from 'next/headers';
import { Analytics } from '@vercel/analytics/next';
export const metadata = {
  metadataBase: new URL('https://www.vitalia.energy'),
  title: 'Vitalia · Dietética',
  description: 'Explorá el catálogo de Vitalia. Armá tu carrito y coordiná tu pedido por WhatsApp.',
  icons: { icon: '/images/favicon.webp' }
};
export default async function RootLayout({ children }) {
  const nonce=(await headers()).get('x-nonce')||undefined;
  return <html lang="es-AR" suppressHydrationWarning><body><Provider nonce={nonce}>{children}<WelcomePopup/></Provider><Analytics /></body></html>;
}
