'use client';
import {useEffect,useRef,useState} from 'react';
import {usePathname} from 'next/navigation';
import Icon from './icon';
import {POPUP_DELAY_MS,POPUP_DISMISSED_KEY,POPUP_SESSION_KEY,POPUP_SUBSCRIBED_KEY,canShowPopup,triggerAllowed} from '../lib/popup-rules';
import {CART_TOKEN_KEY} from './use-cart';

const read=(storage,key)=>{try{return window[storage].getItem(key);}catch{return null;}};
const write=(storage,key,value)=>{try{window[storage].setItem(key,value);}catch{}};
const isDesktop=()=>typeof window.matchMedia==='function'&&window.matchMedia('(min-width: 701px)').matches;
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function WelcomePopup() {
  const path=usePathname()||'/';
  const dialog=useRef(null),title=useRef(null),nameInput=useRef(null),returnFocus=useRef(null);
  const started=useRef(0),opened=useRef(false);
  const [open,setOpen]=useState(false),[desktop,setDesktop]=useState(false);
  const [form,setForm]=useState({name:'',email:'',consent:false,website:''});
  const [errors,setErrors]=useState({}),[alert,setAlert]=useState(null),[busy,setBusy]=useState(false),[done,setDone]=useState(null);

  useEffect(()=>{if(!started.current)started.current=Date.now();if(new URLSearchParams(window.location.search).get('utm_medium')==='email')write('localStorage',POPUP_SUBSCRIBED_KEY,'1');},[]);

  useEffect(()=>{
    if(opened.current)return;
    function show(trigger,extra={}) {
      if(opened.current)return;
      const context={path,desktop:isDesktop(),elapsedMs:Date.now()-started.current,...extra};
      if(!triggerAllowed({trigger,...context}))return;
      const otherDialogOpen=Boolean(document.querySelector('dialog[open]:not(.vp),[role="dialog"]:not(.vp)'));
      if(!canShowPopup({path,now:Date.now(),dismissedAt:read('localStorage',POPUP_DISMISSED_KEY),subscribed:read('localStorage',POPUP_SUBSCRIBED_KEY),search:window.location.search,shownThisSession:read('sessionStorage',POPUP_SESSION_KEY)==='1',otherDialogOpen}))return;
      opened.current=true;write('sessionStorage',POPUP_SESSION_KEY,'1');
      returnFocus.current=document.activeElement;setDesktop(context.desktop);setOpen(true);
    }
    const timer=setTimeout(()=>show('time'),Math.max(0,POPUP_DELAY_MS-(Date.now()-started.current)));
    const scroll=()=>{const max=document.documentElement.scrollHeight-window.innerHeight;if(max>0)show('scroll',{scrollRatio:window.scrollY/max});};
    const exit=event=>{if(!event.relatedTarget&&event.clientY<=0)show('exit');};
    window.addEventListener('scroll',scroll,{passive:true});document.addEventListener('mouseout',exit);
    return()=>{clearTimeout(timer);window.removeEventListener('scroll',scroll);document.removeEventListener('mouseout',exit);};
  },[path]);

  useEffect(()=>{
    const element=dialog.current;if(!open||!element)return;
    if(typeof element.showModal==='function'&&!element.open)element.showModal();else element.setAttribute('open','');
    document.body.classList.add('locked');
    (desktop?nameInput.current:title.current)?.focus();
    return()=>document.body.classList.remove('locked');
  },[open,desktop]);

  // Si se navega al carrito con el popup abierto, se cierra.
  useEffect(()=>{if(open&&/^\/checkout/.test(path))close();},[path]);

  function close() {
    const element=dialog.current;
    if(element?.open&&typeof element.close==='function')element.close();else element?.removeAttribute('open');
    if(read('localStorage',POPUP_SUBSCRIBED_KEY)!=='1')write('localStorage',POPUP_DISMISSED_KEY,String(Date.now()));
    document.body.classList.remove('locked');setOpen(false);
    const target=returnFocus.current;if(target&&typeof target.focus==='function'&&document.contains(target))target.focus();
  }
  function validate() {
    const next={};
    if(!form.name.trim())next.name='Contanos cómo te llamás.';
    if(!EMAIL.test(form.email.trim()))next.email='Revisá el mail: falta la @ o el dominio (ej.: tu@mail.com).';
    if(!form.consent)next.consent='Para mandarte el código necesitamos que aceptes recibir mails.';
    return next;
  }
  async function submit(event) {
    event.preventDefault();if(busy)return;
    const next=validate();setErrors(next);setAlert(null);
    if(Object.keys(next).length){document.getElementById(`vp-${Object.keys(next)[0]}`)?.focus();return;}
    setBusy(true);
    try{
      const response=await fetch('/api/welcome',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:form.name.trim(),email:form.email.trim(),consent:form.consent,website:form.website})});
      const result=await response.json().catch(()=>({}));
      if(response.ok){
        write('localStorage',POPUP_SUBSCRIBED_KEY,'1');
        if(result.cartToken)write('localStorage',CART_TOKEN_KEY,result.cartToken);
        setDone({name:form.name.trim(),email:form.email.trim()});
        setTimeout(()=>title.current?.focus(),0);
      }else if(result.field){setErrors({[result.field]:result.error});}
      else if(response.status===409)setAlert({title:'Este mail ya recibió el código de bienvenida.',text:'Si no lo encontrás, buscalo en spam o promociones.'});
      else if(response.status===429)setAlert({title:'Probá de nuevo en unos minutos.'});
      else setAlert({title:'No pudimos mandarte el código. Probá de nuevo en un rato.'});
    }catch{setAlert({title:'No pudimos mandarte el código. Probá de nuevo en un rato.'});}
    finally{setBusy(false);}
  }
  const set=key=>event=>{const value=key==='consent'?event.target.checked:event.target.value;setForm(f=>({...f,[key]:value}));if(errors[key])setErrors(e=>({...e,[key]:undefined}));};
  if(!open)return null;
  const kind=desktop?'vp-modal':'vp-sheet';
  return <dialog ref={dialog} aria-modal="true" className={`vp ${kind}${done?' vp-success':''}`} aria-labelledby="vp-title" aria-describedby={done?undefined:'vp-sub'}
    onCancel={event=>{event.preventDefault();close();}} onClick={event=>{if(event.target===dialog.current)close();}}>
    {!desktop&&<div className="vp-grab" aria-hidden="true"></div>}
    <button className="vp-close" type="button" aria-label="Cerrar" onClick={close}><Icon name="x"/></button>
    {done?<>
      <div className="vp-ok-icon" aria-hidden="true"><Icon name="check"/></div>
      <h2 id="vp-title" tabIndex={-1} ref={title}>¡Listo, {done.name}!</h2>
      <p className="vp-sub" role="status">Te mandamos tu código a <b>{done.email}</b>. Revisá también spam.</p>
      <button className="primary" type="button" onClick={close}>Seguir comprando</button>
      <p className="vp-fine">Es de un solo uso. Lo cargás en el carrito, en «¿Tenés un código de descuento?».</p>
    </>:<>
      {desktop&&<p className="vp-eyebrow">Bienvenida</p>}
      <h2 id="vp-title" tabIndex={-1} ref={title}>10% off en tu primera compra</h2>
      <p className="vp-sub" id="vp-sub">Dejanos tu nombre y mail y te mandamos un código de un solo uso.</p>
      {alert&&<div className="vp-alert" role="alert"><Icon name="alert"/><div><p><b>{alert.title}</b></p>{alert.text&&<p>{alert.text}</p>}</div></div>}
      <form noValidate onSubmit={submit} aria-busy={busy||undefined}>
        <div className={`vp-field${errors.name?' has-error':''}`}><label htmlFor="vp-name">Nombre</label><input id="vp-name" ref={nameInput} name="name" autoComplete="given-name" maxLength={80} placeholder="¿Cómo te llamás?" required value={form.name} onChange={set('name')} aria-invalid={errors.name?'true':undefined} aria-describedby={errors.name?'vp-name-err':undefined}/>{errors.name&&<p className="vp-err" id="vp-name-err"><Icon name="alert"/>{errors.name}</p>}</div>
        <div className={`vp-field${errors.email?' has-error':''}`}><label htmlFor="vp-email">Email</label><input id="vp-email" type="email" name="email" autoComplete="email" inputMode="email" maxLength={254} placeholder="tu@mail.com" required value={form.email} onChange={set('email')} aria-invalid={errors.email?'true':undefined} aria-describedby={errors.email?'vp-email-err':undefined}/>{errors.email&&<p className="vp-err" id="vp-email-err"><Icon name="alert"/>{errors.email}</p>}</div>
        <div className="vp-hp" aria-hidden="true"><label htmlFor="vp-website">Sitio web</label><input id="vp-website" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')}/></div>
        <div className="vp-check-wrap"><label className={`vp-check${errors.consent?' has-error':''}`}><input id="vp-consent" type="checkbox" name="consent" required checked={form.consent} onChange={set('consent')} aria-invalid={errors.consent?'true':undefined} aria-describedby={errors.consent?'vp-consent-err':undefined}/><span>Acepto recibir novedades y promos de Vitalia por mail. Me puedo dar de baja cuando quiera.</span></label>{errors.consent&&<p className="vp-err" id="vp-consent-err"><Icon name="alert"/>{errors.consent}</p>}</div>
        <button className="primary" type="submit" disabled={busy} aria-busy={busy||undefined}>{busy?'Enviando…':'Quiero mi 10%'}</button>
        <div className="vp-foot"><p className="vp-note">Se suma a las otras promos.</p><button className="vp-skip" type="button" onClick={close}>No, gracias</button></div>
      </form>
    </>}
  </dialog>;
}
