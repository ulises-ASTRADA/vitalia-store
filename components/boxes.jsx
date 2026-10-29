'use client';
import {useMemo} from 'react';
import BoxBuilder from './box-builder';
import SiteHeader from './site-header';
import SiteFooter from './site-footer';
import FloatingCart from './floating-cart';
import {useCart} from './use-cart';

export default function Boxes({initialCatalog,storeWhatsappUrl}) {
  const {products,settings}=initialCatalog;
  const {loaded,count,total,addSelection}=useCart(products);
  const formatter=useMemo(()=>new Intl.NumberFormat('es-AR',{style:'currency',currency:settings.currency,maximumFractionDigits:2}),[settings.currency]);
  const money=value=>formatter.format(value);
  return <>
    <SiteHeader current="boxes"/>
    <main className="shell boxes-page"><h1 className="sr-only">Boxes Vitalia</h1><BoxBuilder products={products} money={money} ready={loaded} onAdd={addSelection}/></main>
    <SiteFooter whatsappUrl={storeWhatsappUrl}/>
    <FloatingCart count={count} total={total} money={money}/>
  </>;
}
