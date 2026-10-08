import './globals.css';
import Provider from '../components/provider';
export const metadata = {
  title: 'Vitalia · Dietética',
  description: 'Explorá el catálogo de Vitalia. Armá tu carrito y coordiná tu pedido por WhatsApp.',
  robots: { index: false, follow: false },
  icons: { icon: '/images/favicon.webp' }
};
export default function RootLayout({ children }) {
  return <html lang="es-AR" suppressHydrationWarning><body><Provider>{children}</Provider></body></html>;
}
