'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import NextLink from 'next/link';
import NextImage from 'next/image';
import {Button,IconButton,Input,Textarea} from '@chakra-ui/react';
import {useTheme} from 'next-themes';
import {useCart} from './use-cart';
import CartSuggestions from './cart-suggestions';
import {getRecommendations} from '../lib/recommendations';
import {canOffer} from '../lib/cart-offers';
const Link=NextLink.default||NextLink,Image=NextImage.default||NextImage;
function CartPhoto({product}){
  const [broken,setBroken]=useState(false);
  const src=broken?'/images/logo-web.webp':product.imagen||'/images/logo-web.webp';
  return <Image src={src} alt={product.nombre} width={80} height={80} sizes="80px" loading="lazy" unoptimized={!src.startsWith('/images/')} onError={()=>setBroken(true)}/>;
}
export default function Checkout({initialCatalog}){
  const [products,setProducts]=useState(initialCatalog.products),[settings,setSettings]=useState(initialCatalog.settings);
  const {loaded,items,total,savings,acceptOffer,change:changeCart,remove:removeCart}=useCart(products);
  const [customer,setCustomer]=useState({name:'',locality:'',province:'',notes:''});
  const [ready,setReady]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[copied,setCopied]=useState(false);
  const [mounted,setMounted]=useState(false),{resolvedTheme,setTheme}=useTheme(),message=useRef(null);
  useEffect(()=>setMounted(true),[]);
  const formatter=useMemo(()=>new Intl.NumberFormat('es-AR',{style:'currency',currency:settings.currency,maximumFractionDigits:2}),[settings.currency]);
  const money=n=>formatter.format(n);
  const recommendations=useMemo(()=>getRecommendations(products,items).filter(product=>items.some(item=>!item.offerSourceId&&canOffer(product,item.product))),[products,items]);
  function addSuggestion(product){if(busy)return;reset();const problem=acceptOffer(product);if(problem)setError(problem);}
  function reset(){setReady(null);setError('');setCopied(false);}
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
      const response=await fetch('/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...customer,name:customer.name.trim(),locality:customer.locality.trim(),province:customer.province.trim(),items:items.map(({product,quantity,offerSourceId})=>({id:product.id,quantity,expectedPrice:product.precio,...(offerSourceId?{offerSourceId}:{})}))})});
      const result=await response.json();
      if(!response.ok){if(result.code==='CATALOG_CHANGED')await refreshCatalog();throw Error(result.error||'No pudimos preparar el pedido.');}
      setReady(result);
    }catch(problem){setError(problem.message||'No pudimos preparar el pedido.');}finally{setBusy(false);}
  }
  async function copy(){try{await navigator.clipboard.writeText(ready.message);setCopied(true);}catch{message.current?.select();setError('Seleccioná y copiá el mensaje.');}}
  return <>
    <header className="checkout-header"><Link href="/" className="brand" aria-label="Vitalia, inicio"><Image className="brand-logo" src="/images/logo-web.webp" alt="Vitalia · Dietética" width={156} height={100} sizes="156px" loading="eager"/></Link><Link href="/" className="checkout-back">← Volver al catálogo</Link><IconButton unstyled className="theme-toggle" aria-label={mounted&&resolvedTheme==='dark'?'Activar modo claro':'Activar modo oscuro'} onClick={()=>setTheme(resolvedTheme==='dark'?'light':'dark')}>{mounted&&resolvedTheme==='dark'?'☀️':'🌙'}</IconButton></header>
    <main className="checkout-shell"><h1>Tu pedido</h1>
      {(settings.testCheckout||settings.isPreview)&&<p className="preview-note">Modo de prueba · Preparar el pedido no envía mensajes.</p>}
      {!loaded?<p role="status">Cargando tu pedido…</p>:!items.length?<section className="checkout-empty"><h2>Tu pedido empieza con algo rico.</h2><p>Explorá el catálogo y agregá los productos que te gusten.</p><Link href="/" className="secondary">Explorar productos</Link></section>:
      <form className="checkout-form" onSubmit={checkout}><div className="checkout-layout"><div className="checkout-main">
        <section className="checkout-card" aria-labelledby="items-title"><h2 id="items-title">Productos elegidos</h2>{items.map(({product,quantity,subtotal,savings:lineSavings})=><article className="checkout-line" key={product.id}><CartPhoto product={product}/><div className="checkout-line-info"><h3>{product.nombre}</h3><p>{product.presentacion||'Presentación a confirmar'} · {money(product.precio)} por presentación</p>{lineSavings>0&&<p className="offer-saving">10% en una presentación · Ahorrás {money(lineSavings)}</p>}<div className="checkout-line-actions"><div className="stepper" aria-label={`Cantidad de ${product.nombre}`}><IconButton unstyled type="button" disabled={busy} aria-label={`Quitar una presentación de ${product.nombre}`} onClick={()=>change(product,-1)}>−</IconButton><span aria-live="polite">{quantity}</span><IconButton unstyled type="button" disabled={busy} aria-label={`Sumar una presentación de ${product.nombre}`} onClick={()=>change(product,1)}>+</IconButton></div><span className="offer-prices">{lineSavings>0&&<del>{money(product.precio*quantity)}</del>}<strong>{money(subtotal)}</strong></span><Button unstyled type="button" className="remove-button" disabled={busy} aria-label={`Quitar ${product.nombre}`} onClick={()=>remove(product.id)}>Quitar</Button></div></div></article>)}</section>
        <section className="checkout-card" aria-labelledby="customer-title"><h2 id="customer-title">Tus datos</h2><div id="customer-fields"><p className="customer-required">Nombre, localidad y provincia son obligatorios.</p><div className="checkout-fields">{[['name','Tu nombre',80,'name','¿Cómo te llamás?'],['locality','Localidad',100,'address-level2','Ej.: Villa Allende'],['province','Provincia',100,'address-level1','Ej.: Córdoba']].map(([key,label,max,autocomplete,placeholder])=><div key={key}><label htmlFor={`customer-${key}`}>{label}</label><Input unstyled id={`customer-${key}`} value={customer[key]} maxLength={max} autoComplete={autocomplete} placeholder={placeholder} required disabled={busy} onChange={event=>{event.target.setCustomValidity('');setCustomer(c=>({...c,[key]:event.target.value}));reset();}}/></div>)}</div><label htmlFor="customer-notes">¿Algo que debamos saber? <span>(opcional)</span></label><Textarea unstyled id="customer-notes" value={customer.notes} maxLength={500} rows={3} disabled={busy} onChange={event=>{setCustomer(c=>({...c,notes:event.target.value}));reset();}}/></div></section>
      </div><aside className="checkout-sidebar" aria-labelledby="summary-title"><section className="checkout-card checkout-summary"><h2 id="summary-title">Resumen del pedido</h2>{savings>0&&<div className="checkout-savings" aria-live="polite"><div><span>Subtotal sin descuento</span><del>{money(total+savings)}</del></div><div className="offer-saving"><span>Ahorro por sugerencias (10%)</span><strong>−{money(savings)}</strong></div></div>}<div className="total-row" aria-live="polite"><span>Total</span><strong>{money(total)}</strong></div><p className="cart-disclaimer">A confirmar: disponibilidad, envío y forma de pago. El pedido se confirma al conversar por WhatsApp.</p>{error&&<p className="form-message" role="alert">{error}</p>}{!settings.checkoutEnabled&&<p className="form-message">Los pedidos por WhatsApp todavía no están habilitados.</p>}
      {ready?<div id="checkout-ready"><p>{ready.requiresCopy?'El pedido es largo: copiá el mensaje y pegalo en WhatsApp.':'Tu mensaje está listo. Revisalo antes de enviarlo.'}</p><Textarea unstyled id="order-message" ref={message} value={ready.message} readOnly aria-label="Mensaje del pedido" rows={8}/><Button unstyled type="button" className="secondary" onClick={copy}>{copied?'Mensaje copiado':'Copiar mensaje'}</Button><a className="primary whatsapp" href={ready.whatsappUrl} target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a></div>:<Button unstyled type="submit" className="primary whatsapp" disabled={busy||!settings.checkoutEnabled}>{busy?'Verificando tu pedido…':'Continuar por WhatsApp'}</Button>}
      </section>
      {recommendations.length>0&&<div className="checkout-card"><CartSuggestions recommendations={recommendations} money={money} busy={busy} onAdd={addSuggestion}/></div>}
      </aside></div></form>}
    </main>
  </>;
}
