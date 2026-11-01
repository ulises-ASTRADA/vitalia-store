'use client';
import {lazy,Suspense,useEffect,useRef,useState} from 'react';
import NextImage from 'next/image';
import NextLink from 'next/link';
import {Button,Input} from '@chakra-ui/react';
import Icon from './icon';
import {Photo} from './product-card';
import ThemeToggle from './theme-toggle';
import SectionNav from './section-nav';
import AnnouncementBar from './announcement-bar';
const Image=NextImage.default||NextImage,Link=NextLink.default||NextLink;
const Modal=lazy(()=>import('./store-modal'));

export default function SiteHeader({current,headerRef,query='',onQueryChange,searchSuggestions=[],formatSearchPrice}) {
  const localHeader=useRef(null),search=useRef(null);
  const ref=headerRef||localHeader;
  const [help,setHelp]=useState(false),[suggestionsOpen,setSuggestionsOpen]=useState(false),[activeSuggestion,setActiveSuggestion]=useState(-1);
  const interactiveSearch=Boolean(onQueryChange);
  const showSuggestions=suggestionsOpen&&searchSuggestions.length>0;
  const chooseSuggestion=suggestion=>{
    onQueryChange?.(suggestion.nombre);
    setSuggestionsOpen(false);
    setActiveSuggestion(-1);
    search.current?.focus({preventScroll:true});
  };
  const handleSearchKeyDown=event=>{
    if(!searchSuggestions.length)return;
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){
      event.preventDefault();
      setSuggestionsOpen(true);
      setActiveSuggestion(current=>event.key==='ArrowDown'?(current+1)%searchSuggestions.length:(current<=0?searchSuggestions.length-1:current-1));
    }else if(event.key==='Enter'&&showSuggestions&&activeSuggestion>=0){
      event.preventDefault();
      chooseSuggestion(searchSuggestions[activeSuggestion]);
    }else if(event.key==='Escape'){
      setSuggestionsOpen(false);
      setActiveSuggestion(-1);
    }
  };
  useEffect(()=>{
    if(activeSuggestion>=0){
      document.getElementById(`search-suggestion-${activeSuggestion}`)?.scrollIntoView({block:'nearest'});
    }
  },[activeSuggestion]);
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
    <AnnouncementBar/>
    <div className="sticky-header" ref={ref}>
      <header className="header"><Link className="brand" href="/" aria-label="Vitalia, inicio"><Image className="brand-logo" src="/images/logo-web.webp" width={156} height={100} sizes="(max-width: 540px) 88px, 112px" alt="Vitalia · Dietética" loading="eager" fetchPriority="high"/></Link>
        <form className="search" role="search" action="/" method="get" onSubmit={onQueryChange?event=>event.preventDefault():undefined} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget)){setSuggestionsOpen(false);setActiveSuggestion(-1);}}}><Icon name="search"/><label className="sr-only" htmlFor="search">Buscar productos</label><Input unstyled id="search" name="q" ref={search} type="search" role={interactiveSearch?'combobox':undefined} aria-autocomplete={interactiveSearch?'list':undefined} aria-controls={interactiveSearch?'search-suggestions':undefined} aria-expanded={interactiveSearch?showSuggestions:undefined} aria-activedescendant={interactiveSearch&&activeSuggestion>=0?`search-suggestion-${activeSuggestion}`:undefined} placeholder="¿Qué estás buscando?" autoComplete="off" value={interactiveSearch?query:undefined} onFocus={()=>setSuggestionsOpen(Boolean(query&&searchSuggestions.length))} onKeyDown={interactiveSearch?handleSearchKeyDown:undefined} onChange={onQueryChange?event=>{onQueryChange(event.target.value);setSuggestionsOpen(true);setActiveSuggestion(-1);}:undefined}/><kbd>/</kbd>
          {showSuggestions&&<ul className="search-suggestions" id="search-suggestions" role="listbox" aria-label="Sugerencias de productos">{searchSuggestions.map((suggestion,index)=><li key={suggestion.id} role="presentation"><button id={`search-suggestion-${index}`} role="option" aria-selected={index===activeSuggestion} tabIndex={-1} type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>chooseSuggestion(suggestion)}><Photo product={suggestion} context="cart" frame={false} className="search-suggestion-image" alt=""/><span className="search-suggestion-info"><strong>{suggestion.nombre}</strong><small>{suggestion.categoria} · {suggestion.presentacion}</small></span><span className="search-suggestion-price">{formatSearchPrice?.(suggestion.precio)}</span></button></li>)}</ul>}
        </form>
        <div className="header-actions"><Button unstyled className="plain help-button" onClick={()=>setHelp(true)}>Cómo comprar</Button><ThemeToggle id="theme-toggle"/></div>
      </header>
      <SectionNav current={current}/>
    </div>
    {help&&<Suspense fallback={null}><Modal open={help} onClose={()=>setHelp(false)} title="Tu pedido, paso a paso" help><p className="eyebrow muted">ASÍ DE SIMPLE</p><h2>Tu pedido, paso a paso.</h2><ol><li><strong>Elegí tus productos.</strong><p>Revisá la presentación de cada uno y sumalo al carrito. Una cantidad equivale a una presentación, no siempre a una unidad individual.</p></li><li><strong>Prepará el mensaje.</strong><p>Completá tu nombre, localidad y provincia. Podés agregar una consulta opcional.</p></li><li><strong>Seguimos por WhatsApp.</strong><p>Enviá el mensaje para confirmar disponibilidad, presentaciones, entrega y forma de pago. El sitio no cobra ni reserva stock.</p></li></ol></Modal></Suspense>}
  </>;
}
