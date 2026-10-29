// Datos del popup, códigos, pedidos y carritos abandonados.
// Producción: Supabase (PostgREST) con la service role, solo en el servidor. Las tablas tienen RLS y
// ningún acceso anon/authenticated (supabase/migrations/20261029120000_vitalia_growth.sql).
// Local y tests (sin claves reales): almacenamiento en memoria. En Vercel sin claves, falla cerrado.
import {CODE_TTL_DAYS,generateCode,newToken,sha256} from '../lib/welcome-code.js';

export class GrowthUnavailable extends Error {}
const DAY=86400000;
export const isRealSecret=value=>typeof value==='string'&&value.length>=20&&!/^(dummy|test|changeme|x+)$/i.test(value);

export function growthMode(env=process.env) {
  if(env.SUPABASE_URL&&isRealSecret(env.SUPABASE_SERVICE_ROLE_KEY))return 'supabase';
  return env.VERCEL==='1'?'unavailable':'memory';
}

function memoryStore() {
  const db=globalThis.__vitaliaGrowthMemory||={subscribers:[],codes:[],orders:[],carts:new Map(),seq:0};
  return {
    mode:'memory',
    async signup({name,email,consentText,now=Date.now()}) {
      if(db.subscribers.some(s=>s.email===email))return {status:'exists'};
      const code=generateCode(),cartToken=newToken(),unsubToken=newToken();
      const subscriber={id:db.subSeq=(db.subSeq||0)+1,name,email,consentText,consentedAt:now,unsubscribedAt:null,cartTokenHash:sha256(cartToken),unsubTokenHash:sha256(unsubToken)};
      db.subscribers.push(subscriber);
      db.codes.push({subscriberId:subscriber.id,codeHash:sha256(code),expiresAt:now+CODE_TTL_DAYS*DAY,redeemedAt:null,reservationHash:null});
      return {status:'created',id:subscriber.id,code,cartToken,unsubToken};
    },
    async removeSubscriber(id){db.subscribers=db.subscribers.filter(s=>s.id!==id);db.codes=db.codes.filter(c=>c.subscriberId!==id);db.carts.delete(id);},
    async codeStatus(code,reservationHash,now=Date.now()) {
      const row=db.codes.find(c=>c.codeHash===sha256(code));
      if(!row||row.expiresAt<=now)return 'invalid';
      if(row.redeemedAt&&row.reservationHash!==reservationHash)return 'used';
      return 'ok';
    },
    async reserveCode(code,reservationHash,now=Date.now()) {
      // Una sola operación síncrona: dos pedidos simultáneos no pueden reservar el mismo código.
      const row=db.codes.find(c=>c.codeHash===sha256(code));
      if(!row||row.expiresAt<=now)return 'invalid';
      if(row.redeemedAt&&row.reservationHash!==reservationHash)return 'used';
      row.redeemedAt=now;row.reservationHash=reservationHash;return 'ok';
    },
    async releaseCode(code,reservationHash){const row=db.codes.find(c=>c.codeHash===sha256(code)&&c.reservationHash===reservationHash);if(row){row.redeemedAt=null;row.reservationHash=null;}},
    async createOrder(order){db.orders.push({...order,id:++db.seq});return `V-${String(db.seq).padStart(4,'0')}`;},
    async saveCart(cartToken,items,now=Date.now()) {
      const s=db.subscribers.find(x=>x.cartTokenHash===sha256(cartToken)&&!x.unsubscribedAt);
      if(!s)return false;
      if(items.length)db.carts.set(s.id,{items,updatedAt:now,convertedAt:null});else db.carts.delete(s.id);
      return true;
    },
    async markCartConverted(cartToken,now=Date.now()){const s=db.subscribers.find(x=>x.cartTokenHash===sha256(cartToken));const cart=s&&db.carts.get(s.id);if(cart)cart.convertedAt=now;},
    async unsubscribe(unsubToken,now=Date.now()) {
      const s=db.subscribers.find(x=>x.unsubTokenHash===sha256(unsubToken));
      if(!s)return false;
      s.unsubscribedAt||=now;db.carts.delete(s.id);return true;
    },
    _db:db,
  };
}

function supabaseStore(env=process.env) {
  const base=`${env.SUPABASE_URL.replace(/\/$/,'')}/rest/v1`;
  const key=env.SUPABASE_SERVICE_ROLE_KEY;
  async function rest(path,{method='GET',body,prefer}={}) {
    let response;
    try{
      response=await fetch(`${base}/${path}`,{method,cache:'no-store',signal:AbortSignal.timeout(8000),headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',...(prefer?{Prefer:prefer}:{})},body:body===undefined?undefined:JSON.stringify(body)});
    }catch{throw new GrowthUnavailable('supabase unreachable');}
    if(response.status===409)return {conflict:true};
    if(!response.ok){console.error('supabase request failed',method,path.split('?')[0],response.status);throw new GrowthUnavailable('supabase error');}
    const text=await response.text();
    return {rows:text?JSON.parse(text):[]};
  }
  const enc=encodeURIComponent;
  async function codeRow(code){const {rows}=await rest(`vitalia_welcome_codes?code_hash=eq.${sha256(code)}&select=expires_at,redeemed_at,reservation_hash`);return rows[0];}
  const statusOf=(row,reservationHash,now)=>!row||Date.parse(row.expires_at)<=now?'invalid':row.redeemed_at&&row.reservation_hash!==reservationHash?'used':'ok';
  return {
    mode:'supabase',
    async signup({name,email,consentText,now=Date.now()}) {
      const cartToken=newToken(),unsubToken=newToken(),code=generateCode();
      const inserted=await rest('vitalia_subscribers?select=id',{method:'POST',prefer:'return=representation',body:{name,email,consent_text:consentText,consented_at:new Date(now).toISOString(),cart_token_hash:sha256(cartToken),unsub_token_hash:sha256(unsubToken)}});
      if(inserted.conflict)return {status:'exists'};
      const id=inserted.rows[0].id;
      try{
        await rest('vitalia_welcome_codes',{method:'POST',prefer:'return=minimal',body:{subscriber_id:id,code_hash:sha256(code),expires_at:new Date(now+CODE_TTL_DAYS*DAY).toISOString()}});
      }catch(error){await this.removeSubscriber(id).catch(()=>{});throw error;}
      return {status:'created',id,code,cartToken,unsubToken};
    },
    async removeSubscriber(id){await rest(`vitalia_subscribers?id=eq.${Number(id)}`,{method:'DELETE',prefer:'return=minimal'});},
    async codeStatus(code,reservationHash,now=Date.now()){return statusOf(await codeRow(code),reservationHash,now);},
    async reserveCode(code,reservationHash,now=Date.now()) {
      // PATCH condicional: Postgres serializa la fila, así que solo una reserva gana.
      const filter=`code_hash=eq.${sha256(code)}&expires_at=gt.${enc(new Date(now).toISOString())}&or=${enc(`(redeemed_at.is.null,reservation_hash.eq.${reservationHash})`)}`;
      const {rows}=await rest(`vitalia_welcome_codes?${filter}&select=id`,{method:'PATCH',prefer:'return=representation',body:{redeemed_at:new Date(now).toISOString(),reservation_hash:reservationHash}});
      if(rows.length===1)return 'ok';
      const status=statusOf(await codeRow(code),reservationHash,now);
      return status==='ok'?'used':status;
    },
    async releaseCode(code,reservationHash){await rest(`vitalia_welcome_codes?code_hash=eq.${sha256(code)}&reservation_hash=eq.${reservationHash}`,{method:'PATCH',prefer:'return=minimal',body:{redeemed_at:null,reservation_hash:null}});},
    async createOrder(order) {
      const {rows}=await rest('vitalia_orders?select=ref',{method:'POST',prefer:'return=representation',body:{subtotal_cents:order.grossCents,suggestion_cents:order.suggestionCents,bulk_cents:order.bulkCents,code_cents:order.codeCents,total_cents:order.totalCents,free_shipping:order.freeShipping,code_hash:order.code?sha256(order.code):null,items:order.items}});
      return rows[0].ref;
    },
    async saveCart(cartToken,items,now=Date.now()) {
      const {rows}=await rest(`vitalia_subscribers?cart_token_hash=eq.${sha256(cartToken)}&unsubscribed_at=is.null&select=id`);
      if(!rows.length)return false;
      const id=rows[0].id;
      if(!items.length){await rest(`vitalia_abandoned_carts?subscriber_id=eq.${id}`,{method:'DELETE',prefer:'return=minimal'});return true;}
      await rest('vitalia_abandoned_carts?on_conflict=subscriber_id',{method:'POST',prefer:'resolution=merge-duplicates,return=minimal',body:{subscriber_id:id,items,updated_at:new Date(now).toISOString(),converted_at:null}});
      return true;
    },
    async markCartConverted(cartToken,now=Date.now()) {
      const {rows}=await rest(`vitalia_subscribers?cart_token_hash=eq.${sha256(cartToken)}&select=id`);
      if(rows.length)await rest(`vitalia_abandoned_carts?subscriber_id=eq.${rows[0].id}`,{method:'PATCH',prefer:'return=minimal',body:{converted_at:new Date(now).toISOString()}});
    },
    async unsubscribe(unsubToken,now=Date.now()) {
      const {rows}=await rest(`vitalia_subscribers?unsub_token_hash=eq.${sha256(unsubToken)}&select=id`,{method:'PATCH',prefer:'return=representation',body:{unsubscribed_at:new Date(now).toISOString()}});
      if(!rows.length)return false;
      await rest(`vitalia_abandoned_carts?subscriber_id=eq.${rows[0].id}`,{method:'DELETE',prefer:'return=minimal'});
      return true;
    },
  };
}

function unavailableStore() {
  const fail=async()=>{throw new GrowthUnavailable('growth store not configured');};
  return {mode:'unavailable',signup:fail,removeSubscriber:fail,codeStatus:fail,reserveCode:fail,releaseCode:fail,createOrder:fail,saveCart:fail,markCartConverted:fail,unsubscribe:fail};
}

export function growthStore(env=process.env) {
  const mode=growthMode(env);
  return mode==='supabase'?supabaseStore(env):mode==='memory'?memoryStore():unavailableStore();
}
