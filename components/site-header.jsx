'use client';
import {lazy,Suspense,useEffect,useRef,useState} from 'react';
import NextImage from 'next/image';
import NextLink from 'next/link';
import {Button,Input} from '@chakra-ui/react';
import Icon from './icon';
import ThemeToggle from './theme-toggle';
import SectionNav from './section-nav';
const Image=NextImage.default||NextImage,Link=NextLink.default||NextLink;
const Modal=lazy(()=>import('./store-modal'));

export default function SiteHeader({current,headerRef,query,onQueryChange}) {
  const localHeader=useRef(null),search=useRef(null);
  const ref=headerRef||localHeader;
  const [help,setHelp]=useState(false);
  useEffect(()=>{
    const element=ref.current;
    const resize=()=>document.documentElement.style.setProperty('--header-height',`${element.getBoundingClientRect().height}px`);
    resize();
    const observer=new ResizeObserver(resize);observer.observe(element);
    const shortcut=event=>{if(event.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!document.querySelector('dialog[open],[role="dialog"]')){event.preventDefault();search.current?.focus({preventScroll:true});}};
    document.addEventListener('keydown',shortcut);
    return()=>{observer.disconnect();document.removeEventListener('keydown',shortcut);};
  },[ref]);
  return <>
    <div className="sticky-header" ref={ref}>
      <header className="header"><Link className="brand" href="/" aria-label="Vitalia, inicio"><Image className="brand-logo" src="/images/logo-web.webp" width={156} height={100} sizes="(max-width: 540px) 88px, 112px" alt="Vitalia · Dietética" loading="eager" fetchPriority="high"/></Link>
        <form className="search" role="search" action="/" method="get" onSubmit={onQueryChange?event=>event.preventDefault():undefined}><Icon name="search"/><label className="sr-only" htmlFor="search">Buscar productos</label><Input unstyled id="search" name="q" ref={search} type="search" placeholder="¿Qué estás buscando?" autoComplete="off" value={query} onChange={onQueryChange?event=>onQueryChange(event.target.value):undefined}/><kbd>/</kbd></form>
        <div className="header-actions"><Button unstyled className="plain help-button" onClick={()=>setHelp(true)}>Cómo comprar</Button><ThemeToggle id="theme-toggle"/></div>
      </header>
      <SectionNav current={current}/>
    </div>
    {help&&<Suspense fallback={null}><Modal open={help} onClose={()=>setHelp(false)} title="Tu pedido, paso a paso" help><p className="eyebrow muted">ASÍ DE SIMPLE</p><h2>Tu pedido, paso a paso.</h2><ol><li><strong>Elegí tus productos.</strong><p>Revisá la presentación de cada uno y sumalo al carrito. Una cantidad equivale a una presentación, no siempre a una unidad individual.</p></li><li><strong>Prepará el mensaje.</strong><p>Completá tu nombre, localidad y provincia. Podés agregar una consulta opcional.</p></li><li><strong>Seguimos por WhatsApp.</strong><p>Enviá el mensaje para confirmar disponibilidad, presentaciones, entrega y forma de pago. El sitio no cobra ni reserva stock.</p></li></ol></Modal></Suspense>}
  </>;
}
