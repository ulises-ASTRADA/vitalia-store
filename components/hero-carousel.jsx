'use client';
import {useCallback, useEffect, useRef, useState} from 'react';
import NextImage from 'next/image';
const Image = NextImage.default || NextImage;
import {productPath} from '../lib/product-links';

// Fotos del hero. El texto de la izquierda queda fijo; solo rotan estas fotos.
// Nombres e imágenes reales del catálogo (data/catalog.json). La slide 1 es la composición original.
export const HERO_SLIDES=[
  {photos:[
    {id:'N023',nombre:'Mix tropical',imagen:'/images/product-023.webp'},
    {id:'N002',nombre:'Chalitas de almendra a las finas hierbas a base de harina de almendras',imagen:'/images/product-002.webp'},
    {id:'N037',nombre:'Granola tradicional',imagen:'/images/product-037.webp'}
  ]},
  {photos:[{id:'N038',nombre:'Granola de chocolate "Vitalia"',imagen:'/images/product-038.webp'}]},
  {photos:[{id:'N003',nombre:'Chalitas de almendra',imagen:'/images/product-003.webp'}]}
];
export const HERO_INTERVAL=6000;
const POSITIONS=['one','two','three'];
const slideName=slide=>slide.photos.map(photo=>photo.nombre).join(', ');
const reducedMotion=()=>typeof window!=='undefined'&&Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

function Arrow({dir}){return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={dir==='prev'?'m15 5-7 7 7 7':'m9 5 7 7-7 7'}/></svg>;}

export default function HeroCarousel({slides=HERO_SLIDES,interval=HERO_INTERVAL}){
  const total=slides.length;
  // Sin JS las fotos quedan en una fila con scroll-snap (CSS @media (scripting:none)): nada se rompe.
  const [enhanced,setEnhanced]=useState(false);
  const [index,setIndex]=useState(0);
  // playing: el autoplay está activo (botón Pausar/Reanudar). Lo apaga el usuario o "reducir movimiento".
  const [playing,setPlaying]=useState(false);
  // Pausas temporales: mouse encima, foco de teclado adentro, dedo apoyado, pestaña oculta, fuera de pantalla.
  const [hovered,setHovered]=useState(false),[focused,setFocused]=useState(false),[touching,setTouching]=useState(false);
  const [hidden,setHidden]=useState(false),[offscreen,setOffscreen]=useState(false);
  const [reduced,setReduced]=useState(false);
  const root=useRef(null),swipe=useRef(null);

  useEffect(()=>{
    const reduce=reducedMotion();
    setReduced(reduce);
    setPlaying(!reduce);
    setEnhanced(true);
    const onVisibility=()=>setHidden(document.visibilityState==='hidden');
    onVisibility();
    document.addEventListener('visibilitychange',onVisibility);
    let observer;
    if(typeof IntersectionObserver!=='undefined'&&root.current){
      observer=new IntersectionObserver(([entry])=>setOffscreen(!entry.isIntersecting),{threshold:0.25});
      observer.observe(root.current);
    }
    return()=>{document.removeEventListener('visibilitychange',onVisibility);observer?.disconnect();};
  },[]);

  const running=enhanced&&playing&&!hovered&&!focused&&!touching&&!hidden&&!offscreen&&total>1;
  useEffect(()=>{
    if(!running)return;
    const timer=setInterval(()=>setIndex(i=>(i+1)%total),interval);
    return()=>clearInterval(timer);
  },[running,interval,total]);

  // Si el usuario la mueve a mano, el autoplay no vuelve hasta recargar (o hasta que toque Reanudar).
  const goTo=useCallback(next=>{setPlaying(false);setIndex(((next%total)+total)%total);},[total]);

  function onPointerDown(event){
    if(event.pointerType==='mouse')return;
    setTouching(true);
    swipe.current={x:event.clientX,y:event.clientY};
  }
  function onPointerEnd(event){
    if(event.pointerType==='mouse')return;
    setTouching(false);
    const start=swipe.current;swipe.current=null;
    if(!start||event.type==='pointercancel')return;
    const dx=event.clientX-start.x,dy=event.clientY-start.y;
    if(Math.abs(dx)>40&&Math.abs(dx)>Math.abs(dy))goTo(index+(dx<0?1:-1));
  }
  // Solo el foco de teclado pausa: un clic con mouse en Reanudar no debe dejarlo pausado.
  function onFocus(event){let keyboard=true;try{keyboard=event.target.matches(':focus-visible');}catch{}setFocused(keyboard);}
  function onBlur(event){if(!root.current?.contains(event.relatedTarget))setFocused(false);}

  return <section ref={root} className={`hero-photos hero-carousel${enhanced?' is-enhanced':''}${reduced?' is-reduced':''}`} aria-roledescription="carrusel" aria-label="Productos destacados" data-playing={running?'true':'false'}
    onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)} onFocus={onFocus} onBlur={onBlur}>
    <div className="hero-frame">
    <div className="hero-track" aria-live={enhanced&&playing?'off':'polite'} onPointerDown={enhanced?onPointerDown:undefined} onPointerUp={enhanced?onPointerEnd:undefined} onPointerCancel={enhanced?onPointerEnd:undefined}>
      {slides.map((slide,s)=>{
        const active=s===index,single=slide.photos.length===1;
        return <div key={s} className={`hero-slide${active?' is-active':''}${single?' is-single':''}`} role="group" aria-roledescription="slide" aria-label={`${s+1} de ${total}: ${slideName(slide)}`} inert={enhanced&&!active?true:undefined}>
          {slide.photos.map((photo,p)=>{
            const first=s===0&&p===0;
            const href=productPath(photo);
            return <a key={photo.id} className={`hero-photo-link${single?' photo-solo':` photo-${POSITIONS[p]}`}`} href={href}>
              <Image className="hero-photo" src={photo.imagen} width={240} height={250} alt={photo.nombre} sizes={single?'(max-width: 767px) calc(100vw - 68px), 240px':'(max-width: 767px) 36vw, 240px'} loading={first?'eager':'lazy'} fetchPriority={first?'high':'auto'}/>
            </a>;
          })}
        </div>;
      })}
    </div>
    <span className="hero-stamp" aria-hidden="true">PARA<br/>COMPARTIR<br/><b>Y DISFRUTAR</b></span>
    <button type="button" className="hero-arrow hero-prev" hidden={!enhanced} aria-label="Foto anterior" onClick={()=>goTo(index-1)}><Arrow dir="prev"/></button>
    <button type="button" className="hero-arrow hero-next" hidden={!enhanced} aria-label="Foto siguiente" onClick={()=>goTo(index+1)}><Arrow dir="next"/></button>
    </div>
    <div className="hero-controls">
      <div className="hero-dots">{slides.map((_,s)=><button key={s} type="button" className="hero-dot" aria-label={`Foto ${s+1} de ${total}`} aria-current={s===index?'true':undefined} onClick={()=>goTo(s)}><span/></button>)}</div>
      <button type="button" className="hero-toggle" aria-label={playing?'Pausar':'Reanudar'} onClick={()=>setPlaying(p=>!p)}>
        {playing?<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6v12M15 6v12"/></svg>:<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7z"/></svg>}
      </button>
    </div>
  </section>;
}
