import NextLink from 'next/link';
const Link=NextLink.default||NextLink;
export default function SectionNav({current}) {
  return <nav className="section-nav" aria-label="Secciones de la tienda"><Link href="/" aria-current={current==='catalog'?'page':undefined}>Catálogo</Link><Link href="/boxes" aria-current={current==='boxes'?'page':undefined}>Boxes</Link></nav>;
}
