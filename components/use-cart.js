'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {canOffer,priceCart} from '../lib/cart-offers';
const KEY='vitalia-cart-v1';
const OFFERS_KEY='vitalia-cart-offers-v1';
export function useCart(products,{catalogReady=true}={}) {
  const [cart,setCart]=useState({}),[loaded,setLoaded]=useState(false);
  const [offers,setOffers]=useState({});
  const currentOffers=useRef({});
  const current=useRef(cart),hydrated=useRef(false);
  function commit(next,nextOffers=currentOffers.current){
    const lines=Object.entries(next).map(([id,quantity])=>({product:products.find(p=>p.id===id),quantity})).filter(i=>i.product);
    const validOffers=Object.fromEntries(priceCart(lines,nextOffers).filter(i=>i.offerSourceId).map(i=>[i.product.id,i.offerSourceId]));
    current.current=next;currentOffers.current=validOffers;setCart(next);setOffers(validOffers);
    try{localStorage.setItem(KEY,JSON.stringify(next));localStorage.setItem(OFFERS_KEY,JSON.stringify(validOffers));}catch{}
  }
  useEffect(()=>{
    if(!catalogReady)return;
    if(!hydrated.current){
      hydrated.current=true;
      let saved={};try{saved=JSON.parse(localStorage.getItem(KEY)||'{}');}catch{}
      if(!saved||typeof saved!=='object'||Array.isArray(saved))saved={};
      let savedOffers={};try{savedOffers=JSON.parse(localStorage.getItem(OFFERS_KEY)||'{}');}catch{}
      if(!savedOffers||typeof savedOffers!=='object'||Array.isArray(savedOffers))savedOffers={};
      currentOffers.current=savedOffers;
      commit(Object.fromEntries(Object.entries(saved).filter(([id,q])=>/^[A-Za-z0-9_-]{1,60}$/.test(id)&&Number.isInteger(q)&&q>0&&q<=99&&products.some(p=>p.id===id&&p.disponibilidad!=='agotado'))));
      setLoaded(true);
    }else{
      const next=Object.fromEntries(Object.entries(current.current).filter(([id])=>products.some(p=>p.id===id&&p.disponibilidad!=='agotado')));
      commit(next);
    }
  },[products,catalogReady]);
  const items=useMemo(()=>priceCart(Object.entries(cart).map(([id,quantity])=>({product:products.find(p=>p.id===id),quantity})).filter(item=>item.product),offers),[cart,products,offers]);
  function acceptOffer(product){
    const source=products.find(p=>current.current[p.id]&&!currentOffers.current[p.id]&&canOffer(product,p));
    if(!source||current.current[product.id])return 'Esta sugerencia ya no está disponible.';
    const problem=change(product,1);
    if(problem)return problem;
    commit(current.current,{...currentOffers.current,[product.id]:source.id});
    return '';
  }
  function change(product,delta){
    if(!loaded)return 'Esperá a que cargue tu pedido.';
    const quantity=current.current[product.id]||0;
    if(delta>0){
      if(product.disponibilidad==='agotado')return 'Este producto está agotado.';
      if(quantity>=99)return 'Máximo de 99 presentaciones por producto.';
      if(!quantity&&Object.keys(current.current).length>=50)return 'Podés incluir hasta 50 productos por pedido.';
    }
    const next={...current.current};if(quantity+delta<=0)delete next[product.id];else next[product.id]=quantity+delta;commit(next);
    return '';
  }
  function remove(id){const next={...current.current};delete next[id];commit(next);}
  function addSelection(selection){
    if(!loaded)return 'Esperá a que cargue tu pedido.';
    if(!selection.length)return 'Elegí al menos un producto para tu box.';
    const next={...current.current};
    for(const selected of selection){
      const product=products.find(p=>p.id===selected.id);
      if(!product||product.activo===false||product.disponibilidad==='agotado')return 'Cambió un producto del box. Revisá tu selección.';
      if((next[product.id]||0)>=99)return `Máximo de 99 presentaciones de ${product.nombre}.`;
      next[product.id]=(next[product.id]||0)+1;
    }
    if(Object.keys(next).length>50)return 'Podés incluir hasta 50 productos por pedido. Quitá alguno antes de sumar el box.';
    commit(next);return '';
  }
  return {cart,loaded,items,change,remove,acceptOffer,addSelection,count:items.reduce((s,i)=>s+i.quantity,0),savings:items.reduce((s,i)=>s+Math.round(i.savings*100),0)/100,total:items.reduce((s,i)=>s+Math.round(i.subtotal*100),0)/100};
}
