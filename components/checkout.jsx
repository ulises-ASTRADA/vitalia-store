'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import NextLink from 'next/link';
import NextImage from 'next/image';
import {Button,IconButton,Input,Textarea} from '@chakra-ui/react';
import SiteHeader from './site-header';
import {useCart,CART_CODE_KEY,CART_TOKEN_KEY} from './use-cart';
import Icon from './icon';
import {BULK_DISCOUNT_LABEL,WELCOME_CODE_LABEL,computeTotals,nextGoal} from '../lib/promos';
import {normalizeCode} from '../lib/code-format';
import CartSuggestions from './cart-suggestions';
import {getRecommendations} from '../lib/recommendations';
import {canOffer} from '../lib/cart-offers';
const Link=NextLink.default||NextLink,Image=NextImage.default||NextImage;
function CartPhoto({product}){
  const [broken,setBroken]=useState(false);
  const src=broken?'/images/logo-web.webp':product.imagen||'/images/logo-web.webp';
  return <Image src={src} alt={product.nombre} width={80} height={80} sizes="80px" loading="lazy" unoptimized={!src.startsWith('/images/')} onError={()=>setBroken(true)}/>;
}
const readStore=key=>{try{return localStorage.getItem(key);}catch{return null;}};
function SumLines({money,subtotal,suggestion,bulk,code,freeShipping}){
  return <dl className="sum-lines">
    <div><dt>Subtotal</dt><dd>{money(subtotal)}</dd></div>
    {suggestion>0&&<div className="disc"><dt>Ahorro por sugerencias (10%)</dt><dd>−{money(suggestion)}</dd></div>}
    {bulk>0&&<div className="disc"><dt>{BULK_DISCOUNT_LABEL}</dt><dd>−{money(bulk)}</dd></div>}
    {code>0&&<div className="disc"><dt>{WELCOME_CODE_LABEL}</dt><dd>−{money(code)}</dd></div>}
    <div><dt>Envío</dt><dd>{freeShipping?'Gratis':'Se coordina por WhatsApp'}</dd></div>
  </dl>;
}
function Goal({grossCents,money}){
  const goal=nextGoal(grossCents);
  if(goal.kind==='done')return <div className="goal done" role="status"><Icon name="check"/><p>Tenés envío gratis y 10% off en todo el carrito.</p></div>;
  return <div className="goal" role="status"><p>Te faltan <b>{money(goal.missingCents/100)}</b> {goal.kind==='shipping'?'para el envío gratis.':'para el 10% off en todo el carrito.'}</p><div className="goal-bar" aria-hidden="true"><i style={{width:`${Math.round(goal.progress*100)}%`}}></i></div></div>;
}
export default function Checkout({initialCatalog}){
  const [products,setProducts]=useState(initialCatalog.products),[settings,setSettings]=useState(initialCatalog.settings);
  const {loaded,items,grossCents,suggestionCents,acceptOffer,change:changeCart,remove:removeCart}=useCart(products);
  const [customer,setCustomer]=useState({name:'',locality:'',province:'',notes:''});
  const [error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [applied,setApplied]=useState(null),[codeOpen,setCodeOpen]=useState(false),[codeInput,setCodeInput]=useState(''),[codeError,setCodeError]=useState(''),[codeBusy,setCodeBusy]=useState(false);
  const [ready,setReady]=useState(null);
  const readyTitle=useRef(null),codeField=useRef(null),lastReservation=useRef(null);
  useEffect(()=>{try{const saved=JSON.parse(readStore(CART_CODE_KEY)||'null');if(saved&&normalizeCode(saved.code))setApplied({code:normalizeCode(saved.code),token:typeof saved.token==='string'?saved.token:undefined});}catch{}},[]);
  useEffect(()=>{setReady(null);},[items]);
  useEffect(()=>{if(ready)readyTitle.current?.focus();},[ready]);
  useEffect(()=>{if(codeOpen&&!applied)codeField.current?.focus();},[codeOpen,applied]);
  const preview=useMemo(()=>computeTotals({grossCents,suggestionCents,hasCode:Boolean(applied)}),[grossCents,suggestionCents,applied]);
  function saveCode(next){setApplied(next);try{if(next)localStorage.setItem(CART_CODE_KEY,JSON.stringify(next));else localStorage.removeItem(CART_CODE_KEY);}catch{}}
  async function applyCode(){
    if(codeBusy)return;
    const code=normalizeCode(codeInput);
    if(!code){setCodeError('Código inválido o vencido.');return;}
    setCodeBusy(true);setCodeError('');
    try{
      const response=await fetch('/api/cart/code',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,...(lastReservation.current?.code===code?{codeToken:lastReservation.current.token}:{})})});
      const result=await response.json().catch(()=>({}));
      if(!response.ok){setCodeError(result.error||'Código inválido o vencido.');return;}
      saveCode({code:result.code,...(lastReservation.current?.code===result.code?{token:lastReservation.current.token}:{})});setCodeInput('');setReady(null);
    }catch{setCodeError('No pudimos validar el código. Probá de nuevo en un rato.');}finally{setCodeBusy(false);}
  }
  function removeCode(){if(applied?.token)lastReservation.current=applied;saveCode(null);setReady(null);setCodeOpen(true);}
  const formatter=useMemo(()=>new Intl.NumberFormat('es-AR',{style:'currency',currency:settings.currency,maximumFractionDigits:2}),[settings.currency]);
  const money=n=>formatter.format(n);
  const recommendations=useMemo(()=>getRecommendations(products,items).filter(product=>items.some(item=>!item.offerSourceId&&canOffer(product,item.product))),[products,items]);
  function addSuggestion(product){if(busy)return;reset();const problem=acceptOffer(product);if(problem)setError(problem);}
  function reset(){setError('');setReady(null);}
  function change(product,delta){if(busy)return;reset();const problem=changeCart(product,delta);if(problem)setError(problem);}
  function remove(id){if(busy)return;reset();removeCart(id);}
  async function refreshCatalog(){
    const response=await fetch('/api/catalog?fresh=1',{cache:'no-store'});
    if(!response.ok){setSettings(s=>({...s,checkoutEnabled:false}));throw Error('No pudimos actualizar el catálogo. Recargá antes de continuar.');}
    const data=await response.json();setProducts(data.products);setSettings(data.settings);
  }
  async function checkout(event){
    event.preventDefault();if(busy||!loaded||!items.length||!settings.checkoutEnabled)return;
    for(const field of event.currentTarget.querySelectorAll('[required]')){field.setCustomValidity(field.value.trim()?'':'Completá este campo.');if(!field.reportValidity())return;}
    setBusy(true);reset();
    try{
      const response=await fetch('/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...customer,name:customer.name.trim(),locality:customer.locality.trim(),province:customer.province.trim(),...(applied?{code:applied.code,...(applied.token?{codeToken:applied.token}:{})}:{}),...(/^[0-9a-f]{64}$/.test(readStore(CART_TOKEN_KEY)||'')?{cartToken:readStore(CART_TOKEN_KEY)}:{}),items:items.map(({product,quantity,offerSourceId})=>({id:product.id,quantity,expectedPrice:product.precio,...(offerSourceId?{offerSourceId}:{})}))})});
      const result=await response.json();
      if(!response.ok){
        if(result.code==='CATALOG_CHANGED')await refreshCatalog();
        if(result.code==='CODE_USED'||result.code==='INVALID_CODE'){saveCode(null);setCodeOpen(true);setCodeError(result.error);}
        throw Error(result.error||'No pudimos preparar el pedido.');
      }
      if(applied&&result.codeToken)saveCode({code:applied.code,token:result.codeToken});
      setReady(result);
    }catch(problem){setError(problem.message||'No pudimos preparar el pedido.');}finally{setBusy(false);}
  }
  return <>
    <SiteHeader/>
    <main className="checkout-shell"><h1>Tu pedido</h1>
      {!loaded?<p role="status">Cargando tu pedido…</p>:!items.length?<section className="checkout-empty"><h2>Tu pedido empieza con algo rico.</h2><p>Explorá el catálogo y agregá los productos que te gusten.</p><Link href="/" className="secondary">Explorar productos</Link></section>:
      <form className="checkout-form" onSubmit={checkout}><div className="checkout-layout"><div className="checkout-main">
        <section className="checkout-card" aria-labelledby="items-title"><h2 id="items-title">Productos elegidos</h2>{items.map(({product,quantity,subtotal,savings:lineSavings})=><article className="checkout-line" key={product.id}><CartPhoto product={product}/><div className="checkout-line-info"><h3>{product.nombre}</h3><p>{product.presentacion||'Presentación a confirmar'} · {money(product.precio)} por presentación</p>{lineSavings>0&&<p className="offer-saving">10% en una presentación · Ahorrás {money(lineSavings)}</p>}<div className="checkout-line-actions"><div className="stepper" aria-label={`Cantidad de ${product.nombre}`}><IconButton unstyled type="button" disabled={busy} aria-label={`Quitar una presentación de ${product.nombre}`} onClick={()=>change(product,-1)}>−</IconButton><span aria-live="polite">{quantity}</span><IconButton unstyled type="button" disabled={busy} aria-label={`Sumar una presentación de ${product.nombre}`} onClick={()=>change(product,1)}>+</IconButton></div><span className="offer-prices">{lineSavings>0&&<del>{money(product.precio*quantity)}</del>}<strong>{money(subtotal)}</strong></span><Button unstyled type="button" className="remove-button" disabled={busy} aria-label={`Quitar ${product.nombre}`} onClick={()=>remove(product.id)}>Quitar</Button></div></div></article>)}</section>
        <section className="checkout-card" aria-labelledby="customer-title"><h2 id="customer-title">Tus datos</h2><div id="customer-fields"><p className="customer-required">Nombre, localidad y provincia son obligatorios.</p><div className="checkout-fields">{[['name','Tu nombre',80,'name','¿Cómo te llamás?'],['locality','Localidad',100,'address-level2','Ej.: Villa Allende'],['province','Provincia',100,'address-level1','Ej.: Córdoba']].map(([key,label,max,autocomplete,placeholder])=><div key={key}><label htmlFor={`customer-${key}`}>{label}</label><Input unstyled id={`customer-${key}`} value={customer[key]} maxLength={max} autoComplete={autocomplete} placeholder={placeholder} required disabled={busy} onChange={event=>{event.target.setCustomValidity('');setCustomer(c=>({...c,[key]:event.target.value}));reset();}}/></div>)}</div><label htmlFor="customer-notes">¿Algo que debamos saber? <span>(opcional)</span></label><Textarea unstyled id="customer-notes" value={customer.notes} maxLength={500} rows={3} disabled={busy} onChange={event=>{setCustomer(c=>({...c,notes:event.target.value}));reset();}}/></div></section>
      </div><aside className="checkout-sidebar" aria-labelledby="summary-title">{ready?<section className="checkout-card checkout-summary"><h2 id="summary-title" tabIndex={-1} ref={readyTitle}>Pedido listo para enviar</h2><div className="ref"><span>Número de pedido</span><b>#{ready.orderRef}</b></div><SumLines money={money} subtotal={ready.subtotal} suggestion={ready.suggestionSavings} bulk={ready.bulkDiscount} code={ready.codeDiscount} freeShipping={ready.freeShipping}/><div className="total-row"><span>Total</span><strong>{money(ready.total)}</strong></div>{ready.savings>0&&<p className="sum-save">Ahorrás {money(ready.savings)}</p>}
      <p className="cart-disclaimer">Montos verificados por Vitalia. Este es el mensaje que se abre en WhatsApp:</p><pre className="wa-preview">{ready.message}</pre><a className="primary whatsapp" href={ready.whatsappUrl} rel="noopener noreferrer">Enviar por WhatsApp</a>
      </section>:<section className="checkout-card checkout-summary"><h2 id="summary-title">Resumen del pedido</h2><Goal grossCents={grossCents} money={money}/>
      <div className="code">{applied?<><span className="chip"><Icon name="tag"/>{applied.code}<button className="chip-x" type="button" disabled={busy} aria-label={`Quitar el código ${applied.code}`} onClick={removeCode}><span><Icon name="x"/></span></button></span><p className="code-ok" role="status">Código aplicado: 10% sobre el subtotal de productos.</p></>:!codeOpen?<button className="code-toggle" type="button" aria-expanded="false" aria-controls="code-panel" onClick={()=>setCodeOpen(true)}><Icon name="tag"/>¿Tenés un código de descuento?</button>:<div id="code-panel"><label htmlFor="code-in">Código de descuento</label><div className="code-row"><input id="code-in" ref={codeField} className={codeError?'bad':undefined} value={codeInput} maxLength={20} placeholder="Ej.: BV-XXXX-XXXX" autoComplete="off" autoCapitalize="characters" spellCheck={false} aria-invalid={codeError?'true':undefined} aria-describedby={codeError?'code-err':undefined} onChange={event=>{setCodeInput(event.target.value);setCodeError('');}} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();applyCode();}}}/><button type="button" disabled={codeBusy} aria-busy={codeBusy||undefined} onClick={applyCode}>Aplicar</button></div>{codeError&&<p className="vp-err" id="code-err" role="alert"><Icon name="alert"/>{codeError}</p>}</div>}</div>
      <SumLines money={money} subtotal={preview.grossCents/100} suggestion={preview.suggestionCents/100} bulk={preview.bulkCents/100} code={preview.codeCents/100} freeShipping={preview.freeShipping}/><div className="total-row" aria-live="polite"><span>Total</span><strong>{money(preview.totalCents/100)}</strong></div>{preview.savingsCents>0&&<p className="sum-save">Ahorrás {money(preview.savingsCents/100)}</p>}<p className="cart-disclaimer">A confirmar: disponibilidad y forma de pago. El pedido se confirma al conversar por WhatsApp.</p>{error&&<p className="form-message" role="alert">{error}</p>}{!settings.checkoutEnabled&&<p className="form-message">Los pedidos por WhatsApp todavía no están habilitados.</p>}
      <Button unstyled type="submit" className="primary whatsapp" disabled={busy||!settings.checkoutEnabled}>{busy?'Verificando tu pedido…':'Continuar por WhatsApp'}</Button>
      </section>}
      {recommendations.length>0&&<div className="checkout-card"><CartSuggestions recommendations={recommendations} money={money} busy={busy} onAdd={addSuggestion}/></div>}
      </aside></div></form>}
    </main>
  </>;
}
