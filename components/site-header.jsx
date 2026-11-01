'use client';
import {lazy,Suspense,useEffect,useMemo,useRef,useState} from 'react';
import NextImage from 'next/image';
import NextLink from 'next/link';
import {Button,Input} from '@chakra-ui/react';
import Icon from './icon';
import {Photo} from './product-card';
import ThemeToggle from './theme-toggle';
import SectionNav from './section-nav';
import AnnouncementBar from './announcement-bar';
import {useRouter} from 'next/navigation';
import {productPath} from '../lib/product-links';
import {rankProducts,searchResultsPath,searchSuggestions as suggestProducts} from '../lib/search';
const Image=NextImage.default||NextImage,Link=NextLink.default||NextLink;
const Modal=lazy(()=>import('./store-modal'));

// Fuera de la home el header busca solo: usa el catálogo que ya tiene la página o, si no lo tiene,
// lo pide una vez a /api/catalog (el mismo endpoint público de la home) y lo comparte entre páginas.
let catalogRequest=null;
function loadSearchCatalog(){
  catalogRequest??=fetch('/api/catalog').then(response=>{if(!response.ok)throw Error();return response.json();}).then(data=>({products:data.products||[],settings:data.settings||{}})).catch(error=>{catalogRequest=null;throw error;});
  return catalogRequest;
}
// En los tests (sin App Router montado) cae a una navegación común.
function useNavigate(){
  let router=null;
  try{router=useRouter();}catch{}
  return href=>router?router.push(href):window.location.assign(href);
}

export default function SiteHeader({current,headerRef,variant,catalog,query:homeQuery='',onQueryChange,searchSuggestions:homeSuggestions=[],searchEmpty:homeEmpty=false,formatSearchPrice}) {
  const localHeader=useRef(null),search=useRef(null);
  const ref=headerRef||localHeader;
  const navigate=useNavigate();
  const checkout=variant==='checkout';
  const [help,setHelp]=useState(false),[suggestionsOpen,setSuggestionsOpen]=useState(false),[activeSuggestion,setActiveSuggestion]=useState(-1);
  // La home controla la búsqueda (filtra la grilla); en el resto, el header maneja su propio estado.
  const home=Boolean(onQueryChange);
  const [ownQuery,setOwnQuery]=useState(''),[loadedCatalog,setLoadedCatalog]=useState(null);
  const ownCatalog=catalog||loadedCatalog;
  const query=home?homeQuery:ownQuery;
  const ownSuggestions=useMemo(()=>home?[]:suggestProducts(ownCatalog?.products,ownQuery),[home,ownCatalog,ownQuery]);
  const searchSuggestions=home?homeSuggestions:ownSuggestions;
  const ownFormatter=useMemo(()=>new Intl.NumberFormat('es-AR',{style:'currency',currency:ownCatalog?.settings?.currency||'ARS',maximumFractionDigits:2}),[ownCatalog]);
  const formatPrice=home?formatSearchPrice:value=>ownFormatter.format(value);
  const term=query.trim();
  const searchEmpty=home?homeEmpty:Boolean(ownCatalog&&term&&!rankProducts(ownCatalog.products,term).length);
  const showSuggestions=suggestionsOpen&&searchSuggestions.length>0;
  const showEmpty=suggestionsOpen&&searchEmpty&&!searchSuggestions.length;
  const ensureCatalog=()=>{if(!home&&!ownCatalog)loadSearchCatalog().then(setLoadedCatalog,()=>{});};
  const setQuery=value=>home?onQueryChange(value):setOwnQuery(value);
  const close=()=>{setSuggestionsOpen(false);setActiveSuggestion(-1);};
  const chooseSuggestion=suggestion=>{
    close();
    if(home){
      onQueryChange(suggestion.nombre);
      search.current?.focus({preventScroll:true});
      return;
    }
    setOwnQuery(suggestion.nombre);
    navigate(productPath(suggestion)||searchResultsPath(suggestion.nombre));
  };
  const clearSearch=event=>{
    close();
    if(home){event.preventDefault();onQueryChange('');search.current?.focus({preventScroll:true});}
    else setOwnQuery('');
  };
  const submit=event=>{
    event.preventDefault();
    if(home)return;
    close();
    navigate(searchResultsPath(ownQuery));
  };
  const handleSearchKeyDown=event=>{
    // Patrón combobox: el primer Escape cierra la lista sin borrar (Chrome borra los type=search); el segundo sí borra.
    if(event.key==='Escape'){if(suggestionsOpen){event.preventDefault();close();}return;}
    if(!searchSuggestions.length)return;
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){
      event.preventDefault();
      setSuggestionsOpen(true);
      setActiveSuggestion(current=>event.key==='ArrowDown'?(current+1)%searchSuggestions.length:(current<=0?searchSuggestions.length-1:current-1));
    }else if(event.key==='Enter'&&showSuggestions&&activeSuggestion>=0){
      event.preventDefault();
      chooseSuggestion(searchSuggestions[activeSuggestion]);
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
    {/* Bloque fijo: barra de promos + fila del logo y el buscador. La fila de secciones queda afuera y se va con el scroll. */}
    <div className="sticky-header" ref={ref}>
      {!checkout&&<AnnouncementBar/>}
      <header className={`header${checkout?' header-checkout':''}`}><Link className="brand" href="/" aria-label="Vitalia, inicio"><Image className="brand-logo" src="/images/logo-web.webp" width={156} height={100} sizes="(max-width: 540px) 88px, 112px" alt="Vitalia · Dietética" loading="eager" fetchPriority="high"/></Link>
        {checkout?<Link className="continue-link" href="/"><span aria-hidden="true">←</span> Seguir comprando</Link>:<form className="search" role="search" action="/" method="get" onSubmit={submit} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))close();}}><Icon name="search"/><label className="sr-only" htmlFor="search">Buscar productos</label><Input unstyled id="search" name="q" ref={search} type="search" role="combobox" aria-autocomplete="list" aria-controls="search-suggestions" aria-expanded={showSuggestions} aria-activedescendant={activeSuggestion>=0?`search-suggestion-${activeSuggestion}`:undefined} placeholder="¿Qué estás buscando?" autoComplete="off" value={query} onFocus={()=>{ensureCatalog();setSuggestionsOpen(Boolean(term));}} onKeyDown={handleSearchKeyDown} onChange={event=>{ensureCatalog();setQuery(event.target.value);setSuggestionsOpen(true);setActiveSuggestion(-1);}}/><kbd>/</kbd>
          {showSuggestions&&<ul className="search-suggestions" id="search-suggestions" role="listbox" aria-label="Sugerencias de productos">{searchSuggestions.map((suggestion,index)=><li key={suggestion.id} role="presentation"><button id={`search-suggestion-${index}`} role="option" aria-selected={index===activeSuggestion} tabIndex={-1} type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>chooseSuggestion(suggestion)}><Photo product={suggestion} context="cart" frame={false} className="search-suggestion-image" alt=""/><span className="search-suggestion-info"><strong>{suggestion.nombre}</strong><small>{suggestion.categoria} · {suggestion.presentacion}</small></span><span className="search-suggestion-price">{formatPrice?.(suggestion.precio)}</span></button></li>)}</ul>}
          {showEmpty&&<div className="search-empty" role="status"><p>No encontramos «{term}»</p><Link href="/" onMouseDown={event=>event.preventDefault()} onClick={clearSearch}>Ver todo el catálogo</Link></div>}
        </form>}
        <div className="header-actions"><Button unstyled className="plain help-button" onClick={()=>setHelp(true)}>Cómo comprar</Button><ThemeToggle id="theme-toggle"/></div>
      </header>
    </div>
    {!checkout&&<SectionNav current={current}/>}
    {help&&<Suspense fallback={null}><Modal open={help} onClose={()=>setHelp(false)} title="Tu pedido, paso a paso" help><p className="eyebrow muted">ASÍ DE SIMPLE</p><h2>Tu pedido, paso a paso.</h2><ol><li><strong>Elegí tus productos.</strong><p>Revisá la presentación de cada uno y sumalo al carrito. Una cantidad equivale a una presentación, no siempre a una unidad individual.</p></li><li><strong>Prepará el mensaje.</strong><p>Completá tu nombre, localidad y provincia. Podés agregar una consulta opcional.</p></li><li><strong>Seguimos por WhatsApp.</strong><p>Enviá el mensaje para confirmar disponibilidad, presentaciones, entrega y forma de pago. El sitio no cobra ni reserva stock.</p></li></ol></Modal></Suspense>}
  </>;
}
