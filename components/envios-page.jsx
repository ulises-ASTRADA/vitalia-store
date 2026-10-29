'use client';
import {useMemo,useState} from 'react';
import NextLink from 'next/link';
import SiteHeader from './site-header';
import SiteFooter from './site-footer';
import FloatingCart from './floating-cart';
import Icon from './icon';
import {useCart} from './use-cart';
const Link=NextLink.default||NextLink;

// /envios (spec §5). Todo el copy y los montos llegan armados desde lib/envios.js.
export default function EnviosPage({catalog,page,storeWhatsappUrl}) {
  const {products,settings}=catalog;
  const {count,total}=useCart(products);
  const formatter=useMemo(()=>new Intl.NumberFormat('es-AR',{style:'currency',currency:settings.currency,maximumFractionDigits:2}),[settings.currency]);
  const money=value=>formatter.format(value);
  const [open,setOpen]=useState(()=>new Set([0]));
  const toggle=i=>setOpen(previous=>{const next=new Set(previous);if(next.has(i))next.delete(i);else next.add(i);return next;});
  return <>
    <a className="skip-link" href="#contenido">Ir al contenido</a>
    <SiteHeader current="envios"/>
    <main className="shell" id="contenido"><div className="ship-page">
      <nav className="breadcrumb" aria-label="Ruta de navegación"><ol><li><Link href="/">Inicio</Link></li><li><span aria-current="page">Envíos</span></li></ol></nav>
      <h1>{page.title}</h1>
      <p className="ship-answer">{page.answer}</p>
      <nav className="zone-jump" aria-labelledby="zone-jump-t"><p id="zone-jump-t" className="zone-jump-label">Elegí tu zona</p><ul className="zone-chips">{page.chips.map(chip=><li key={chip.slug}><a className="zone-chip" href={`#${chip.slug}`}><Icon name="pin"/><span>{chip.name}</span></a></li>)}</ul></nav>
      <dl className="ship-facts">{page.facts.map(([term,value])=><div key={term}><dt>{term}</dt><dd>{value}</dd></div>)}</dl>
      {page.groups.map(group=><section className="zone-group" aria-labelledby={group.id} key={group.id}><h2 id={group.id}>{group.title}</h2>
        {group.zones.map(zone=><section className="zone-section" id={zone.slug} aria-labelledby={`${zone.slug}-t`} key={zone.slug}>
          <h3 id={`${zone.slug}-t`}>{zone.name}</h3><p>{zone.line}</p>
          <p className="zone-cost"><Icon name="truck"/><span><strong>{zone.costLine}</strong> {zone.freeLine}</span></p>
          <h4 className="zone-q">{zone.question}</h4><p>{zone.answer}</p>
          {zone.whatsappUrl&&<a className="zone-wa" href={zone.whatsappUrl} rel="noopener"><Icon name="chat"/>Pedir con envío a {zone.name}</a>}
        </section>)}
      </section>)}
      <p className="zone-note">¿No está tu zona? {page.otherZoneUrl?<a href={page.otherZoneUrl} rel="noopener">Preguntanos por WhatsApp</a>:'Preguntanos por WhatsApp'} y te decimos si llegamos.</p>
      <h2 id="como-pedir">Cómo pedir</h2>
      <ol className="ship-steps"><li><strong>Armá tu pedido en la web.</strong> Sumá lo que quieras desde el catálogo.</li><li><strong>Mandalo por WhatsApp.</strong> Desde el carrito, con tu zona y tu dirección.</li><li><strong>Coordinamos la entrega.</strong> Te confirmamos el día, el horario y el pago por WhatsApp.</li></ol>
      {page.orderUrl&&<a className="primary ship-steps-cta" href={page.orderUrl} rel="noopener"><Icon name="chat"/>Hacer un pedido por WhatsApp</a>}
      <h2 id="costos">Costos, plazos y pagos</h2>
      <table className="ship-table"><caption className="sr-only">Costo de envío por zona</caption><thead><tr><th scope="col">Zonas</th><th scope="col">Costo de envío</th></tr></thead><tbody>{page.table.map(row=><tr className={row.free?'ship-free':undefined} key={row.label}><th scope="row">{row.label}</th><td>{row.value}</td></tr>)}</tbody></table>
      <dl className="ship-terms">{page.terms.map(([term,value])=><div key={term}><dt>{term}</dt><dd>{value}</dd></div>)}</dl>
      <section className="pickup" aria-labelledby="retiro"><h3 id="retiro">Retiro en Villa Allende</h3><p className="pickup-addr"><Icon name="pin"/><span>{page.pickup.line}</span></p><p>{page.pickup.note}</p>{page.pickup.mapsUrl&&<p><a href={page.pickup.mapsUrl} rel="noopener">Ver en Google Maps</a></p>}</section>
      <h2 id="faq-title">Preguntas frecuentes</h2>
      <div className="faq" aria-labelledby="faq-title">{page.faq.map((item,i)=><div className="faq-item" key={item.q}>
        <h3><button type="button" className="faq-trigger" id={`faq-q${i}`} aria-expanded={open.has(i)} aria-controls={`faq-a${i}`} onClick={()=>toggle(i)}><span>{item.q}</span><Icon name="chevron"/></button></h3>
        <div className="faq-panel" id={`faq-a${i}`} role="region" aria-labelledby={`faq-q${i}`} hidden={!open.has(i)}><p>{item.a}</p></div>
      </div>)}</div>
      <div className="ship-cta"><Link className="primary" href="/"><Icon name="bag"/>Ver el catálogo</Link><Link className="pdp-secondary" href="/boxes">Ver las boxes</Link></div>
    </div></main>
    <SiteFooter whatsappUrl={storeWhatsappUrl}/>
    <FloatingCart count={count} total={total} money={money}/>
  </>;
}
