import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {growthStore} from '../server/growth-store.js';
import {codePOST} from '../server/growth.js';
import {handleCheckout} from '../server/checkout.js';
import {sha256} from '../lib/welcome-code.js';

const SITE='https://www.vitalia.energy';
const CODE='BV-7K2Q-9MXD';
const KEY='local-service-role-key-not-production';
let ipSeq=1;
const nextIp=()=>`203.0.113.${ipSeq++}`;
function post(path,body){
  return new Request(SITE+path,{method:'POST',headers:{origin:SITE,'content-type':'application/json','x-vercel-forwarded-for':nextIp()},body:JSON.stringify(body)});
}
function withEnv(values,fn){
  return async()=>{
    const previous=Object.fromEntries(Object.keys(values).map(k=>[k,process.env[k]]));
    Object.assign(process.env,values);
    try{await fn();}finally{for(const [k,v] of Object.entries(previous)){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
  };
}
const products=[{id:'A',nombre:'Granola',precio:100000,presentacion:'1 KG',disponibilidad:'disponible'}];
const loadCatalog=async()=>({products});
const checkoutBody=extra=>({items:[{id:'A',quantity:2,expectedPrice:100000}],name:'Prueba',zone:'villa-allende',locality:'',province:'Córdoba',notes:'',...extra});
const future=()=>new Date(Date.now()+60*86400000).toISOString();
const past=()=>new Date(Date.now()-86400000).toISOString();

function startFakeSupabase(){
  const db={codes:[],orders:[],seq:0,writes:[]};
  const faults={reserve:'ok',order:'ok',release:'ok'};
  const take=name=>{const value=faults[name];if(String(value).endsWith('-once'))faults[name]='ok';return String(value).replace(/-once$/,'');};
  const server=createServer((req,res)=>{
    const url=new URL(req.url,'http://127.0.0.1');
    const name=url.pathname.replace(/^\/rest\/v1\//,'');
    let raw='';
    req.on('data',chunk=>{raw+=chunk;});
    req.on('end',()=>{
      const body=raw?JSON.parse(raw):null;
      const send=(status,payload)=>{if(status===499){req.socket.destroy();return;}res.writeHead(status,{'content-type':'application/json'});res.end(payload===undefined?'':JSON.stringify(payload));};
      if(req.method==='GET'&&name==='vitalia_welcome_codes'){
        const hash=url.searchParams.get('code_hash')?.slice(3);
        send(200,db.codes.filter(row=>!hash||row.code_hash===hash));
        return;
      }
      if(req.method==='GET'&&name==='vitalia_orders'){
        if(take('lookup')==='reject'){send(400,{code:'42703',message:'column vitalia_orders.reservation_hash does not exist'});return;}
        const hash=url.searchParams.get('reservation_hash')?.slice(3);
        send(200,db.orders.filter(row=>!hash||row.reservation_hash===hash).map(row=>({ref:row.ref})));
        return;
      }
      if(req.method==='PATCH'&&name==='vitalia_welcome_codes'){
        // PostgREST < 14.4: PATCH con or= y select= que no incluye esas columnas responde 400
        // (42703 column does not exist) y no escribe. select=id solo dispara el fallo.
        if(url.searchParams.has('or')){
          const selected=new Set((url.searchParams.get('select')||'').split(',').filter(Boolean));
          const missing=['redeemed_at','reservation_hash'].find(column=>!selected.has(column));
          if(missing){send(400,{code:'42703',message:`column vitalia_welcome_codes.${missing} does not exist`});return;}
        }
        const hash=url.searchParams.get('code_hash')?.slice(3);
        const only=url.searchParams.get('reservation_hash')?.slice(3);
        const or=url.searchParams.get('or')||'';
        const same=(or.match(/reservation_hash\.eq\.([0-9a-f]{64})/)||[])[1];
        const exp=url.searchParams.get('expires_at');
        const rows=db.codes.filter(row=>{
          if(hash&&row.code_hash!==hash)return false;
          if(only&&row.reservation_hash!==only)return false;
          if(exp?.startsWith('gt.')&&!(Date.parse(row.expires_at)>Date.parse(exp.slice(3))))return false;
          if(or&&!(row.redeemed_at==null||row.reservation_hash===same))return false;
          return true;
        });
        const releasing=body&&body.redeemed_at==null;
        if(releasing){
          if(take('release')==='fail'){send(500,{message:'release failed'});return;}
          for(const row of rows){row.redeemed_at=null;row.reservation_hash=null;}
          db.writes.push('release');
          send(200,[]);
          return;
        }
        const mode=take('reserve');
        for(const row of rows){row.redeemed_at=body.redeemed_at;row.reservation_hash=body.reservation_hash;}
        if(rows.length)db.writes.push('reserve');
        if(mode==='drop'){send(499);return;}
        if(mode==='empty'){send(200,undefined);return;}
        send(200,rows.map(row=>({id:row.id})));
        return;
      }
      if(req.method==='POST'&&name==='vitalia_orders'){
        const mode=take('order');
        if(mode==='fail'){send(500,{message:'order failed'});return;}
        if(body.reservation_hash&&db.orders.some(row=>row.reservation_hash===body.reservation_hash)){send(409,{message:'duplicate'});return;}
        const ref=`V-${String(++db.seq).padStart(4,'0')}`;
        db.orders.push({ref,...body});
        db.writes.push('order');
        if(mode==='drop'){send(499);return;}
        send(200,[{ref}]);
        return;
      }
      if(req.method==='POST'&&name==='rpc/vitalia_prepare_coded_order'){
        const mode=take('prepare');
        if(mode==='fail'||mode==='reject'){send(mode==='reject'?400:500,{code:mode==='reject'?'42703':'500',message:mode==='reject'?'column does not exist':'prepare failed'});return;}
        const code=db.codes.find(row=>row.code_hash===body.p_code_hash);
        if(!code||Date.parse(code.expires_at)<=Date.parse(body.p_at)){send(200,{status:'invalid'});return;}
        if(code.redeemed_at&&code.reservation_hash!==body.p_reservation_hash){send(200,{status:'used'});return;}
        const existing=db.orders.find(row=>row.reservation_hash===body.p_reservation_hash);
        if(existing){
          const same=existing.payload_hash===body.p_payload_hash&&JSON.stringify(existing.items)===JSON.stringify(body.p_items)&&existing.subtotal_cents===body.p_subtotal_cents&&existing.total_cents===body.p_total_cents&&existing.code_cents===body.p_code_cents&&existing.free_shipping===body.p_free_shipping;
          send(200,same?{status:'exists',ref:existing.ref}:{status:'mismatch',ref:existing.ref});
          return;
        }
        code.redeemed_at=body.p_at;code.reservation_hash=body.p_reservation_hash;
        const ref=`V-${String(++db.seq).padStart(4,'0')}`;
        db.orders.push({ref,reservation_hash:body.p_reservation_hash,payload_hash:body.p_payload_hash,items:body.p_items,subtotal_cents:body.p_subtotal_cents,suggestion_cents:body.p_suggestion_cents,bulk_cents:body.p_bulk_cents,code_cents:body.p_code_cents,total_cents:body.p_total_cents,free_shipping:body.p_free_shipping});
        db.writes.push('prepare');
        if(mode==='drop'){send(499);return;}
        send(200,{status:'created',ref});
        return;
      }
      if(req.method==='POST'&&name==='rpc/vitalia_release_unmatched_code'){
        if(take('release')==='reject'){send(400,{code:'42703',message:'column does not exist'});return;}
        const order=db.orders.find(row=>row.reservation_hash===body.p_reservation_hash);
        const code=db.codes.find(row=>row.code_hash===body.p_code_hash&&row.reservation_hash===body.p_reservation_hash);
        if(!code||order){send(200,{status:code?'kept':'missing'});return;}
        code.redeemed_at=null;code.reservation_hash=null;db.writes.push('release');
        send(200,{status:'released'});
        return;
      }
      send(404,{message:'not found'});
    });
  });
  return new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve({
    url:`http://127.0.0.1:${server.address().port}`,db,faults,close:()=>new Promise(done=>server.close(done)),
  })));
}
function seed(db,{code=CODE,expiresAt=future(),redeemedAt=null,reservationHash=null}={}){
  db.codes.push({id:db.codes.length+1,code_hash:sha256(code),expires_at:expiresAt,redeemed_at:redeemedAt,reservation_hash:reservationHash});
}
async function world(){
  const fake=await startFakeSupabase();
  const env={SUPABASE_URL:fake.url,SUPABASE_SERVICE_ROLE_KEY:KEY,VERCEL:'1',VERCEL_ENV:'preview',ALLOW_TEST_CHECKOUT:'true',WHATSAPP_NUMBER:'5491100000000',STORE_NAME:'Vitalia',STORE_CURRENCY:'ARS'};
  return {fake,env,store:()=>growthStore(env)};
}

test('Validar un código vigente, vencido o usado no lo consume',withEnv({},async()=>{
  const {fake,env,store}=await world();
  try{
    seed(fake.db);
    seed(fake.db,{code:'BV-9MXD-7K2Q',expiresAt:past()});
    seed(fake.db,{code:'BV-2345-6789',redeemedAt:new Date().toISOString(),reservationHash:'a'.repeat(64)});
    await withEnv(env,async()=>{
      const live=store();
      let response=await codePOST(post('/api/cart/code',{code:' bv 7k2q 9mxd '}),{store:live});
      assert.equal(response.status,200);
      assert.equal((await response.json()).code,CODE);
      response=await codePOST(post('/api/cart/code',{code:CODE}),{store:live});
      assert.equal(response.status,200);
      assert.equal(fake.db.codes[0].redeemed_at,null);
      assert.equal(fake.db.writes.length,0);
      response=await codePOST(post('/api/cart/code',{code:'BV-9MXD-7K2Q'}),{store:live});
      assert.equal(response.status,404);assert.equal((await response.json()).code,'INVALID_CODE');
      response=await codePOST(post('/api/cart/code',{code:'BV-2345-6789'}),{store:live});
      assert.equal(response.status,409);assert.equal((await response.json()).code,'CODE_USED');
      assert.equal(fake.db.codes[2].reservation_hash,'a'.repeat(64));
    })();
  }finally{await fake.close();}
}));

test('Mismo token y mismo pedido: una referencia, el mismo mensaje y una sola fila de planilla',withEnv({},async()=>{
  const {fake,env,store}=await world();
  seed(fake.db);
  const token='1'.repeat(64);
  const sheets=[];
  const orderBody=checkoutBody({code:CODE,codeToken:token});
  try{
    await withEnv(env,async()=>{
      const firstResponse=await handleCheckout(post('/api/checkout',orderBody),{store:store(),loadCatalog,recordOrder:async()=>{sheets.push('sheet');return 'VIT';}});
      const first=await firstResponse.json();
      assert.equal(firstResponse.status,200,JSON.stringify(first));
      const againResponse=await handleCheckout(post('/api/checkout',orderBody),{store:store(),loadCatalog,recordOrder:async()=>{sheets.push('sheet');return 'VIT';}});
      const again=await againResponse.json();
      assert.equal(againResponse.status,200,JSON.stringify(again));
      assert.equal(again.orderRef,first.orderRef);
      assert.equal(again.message,first.message);
      assert.equal(again.whatsappUrl,first.whatsappUrl);
      assert.equal(fake.db.orders.length,1);
      assert.equal(sheets.length,1);
      assert.equal(fake.db.codes[0].reservation_hash,sha256(token));
    })();
  }finally{await fake.close();}
}));

test('Mismo token y otro contenido: no reinterpreta la referencia ni escribe otra planilla',withEnv({},async()=>{
  const {fake,env,store}=await world();
  seed(fake.db);
  const token='2'.repeat(64);
  const sheets=[];
  try{
    await withEnv(env,async()=>{
      const firstResponse=await handleCheckout(post('/api/checkout',checkoutBody({code:CODE,codeToken:token,name:'Ana',zone:'villa-allende'})),{store:store(),loadCatalog,recordOrder:async()=>{sheets.push('sheet');return 'VIT';}});
      const first=await firstResponse.json();
      assert.equal(firstResponse.status,200,JSON.stringify(first));
      const changed=checkoutBody({code:CODE,codeToken:token,name:'Otra persona',zone:'unquillo',items:[{id:'A',quantity:4,expectedPrice:100000}],email:'otra@example.com'});
      const retry=await handleCheckout(post('/api/checkout',changed),{store:store(),loadCatalog,recordOrder:async()=>{sheets.push('sheet');return 'VIT';}});
      const body=await retry.json();
      assert.equal(retry.status,409,JSON.stringify(body));
      assert.equal(body.code,'ORDER_MISMATCH');
      assert.equal(body.orderRef,first.orderRef);
      assert.equal(body.whatsappUrl,undefined);
      assert.equal(body.message,undefined);
      assert.equal(fake.db.orders.length,1);
      assert.equal(fake.db.orders[0].items[0].quantity,2);
      assert.equal(sheets.length,1);
      assert.equal(fake.db.codes[0].reservation_hash,sha256(token));
    })();
  }finally{await fake.close();}
}));

test('Respuesta perdida después de crear el pedido: el mismo token no abre otro uso',withEnv({},async()=>{
  const {fake,env,store}=await world();
  fake.faults.prepare='drop-once';
  seed(fake.db);
  const token='3'.repeat(64);
  const orderBody=checkoutBody({code:CODE,codeToken:token});
  try{
    await withEnv(env,async()=>{
      const lostResponse=await handleCheckout(post('/api/checkout',orderBody),{store:store(),loadCatalog,recordOrder:async()=>'VIT'});
      const lost=await lostResponse.json();
      assert.equal(lostResponse.status,503,JSON.stringify(lost));
      assert.equal(lost.codeToken,token);
      assert.equal(fake.db.orders.length,1);
      assert.equal(fake.db.codes[0].reservation_hash,sha256(token));
      const retry=await handleCheckout(post('/api/checkout',orderBody),{store:store(),loadCatalog,recordOrder:async()=>'VIT'});
      const done=await retry.json();
      assert.equal(retry.status,200,JSON.stringify(done));
      assert.equal(done.orderRef,fake.db.orders[0].ref);
      assert.equal(fake.db.orders.length,1);
      const other=await handleCheckout(post('/api/checkout',checkoutBody({code:CODE})),{store:store(),loadCatalog});
      assert.equal(other.status,409);
      assert.equal(fake.db.orders.length,1);
    })();
  }finally{await fake.close();}
}));

test('Alta incierta: un 4xx o un 500 no libera una reserva ya tomada',withEnv({},async()=>{
  const {fake,env,store}=await world();
  seed(fake.db,{redeemedAt:new Date().toISOString(),reservationHash:sha256('7'.repeat(64))});
  fake.faults.prepare='reject';
  try{
    await withEnv(env,async()=>{
      const response=await handleCheckout(post('/api/checkout',checkoutBody({code:CODE,codeToken:'7'.repeat(64)})),{store:store(),loadCatalog,recordOrder:async()=>'VIT'});
      const body=await response.json();
      assert.equal(response.status,503,JSON.stringify(body));
      assert.equal(fake.db.orders.length,0);
      assert.equal(fake.db.codes[0].reservation_hash,sha256('7'.repeat(64)));
      assert.equal(fake.db.writes.includes('release'),false);
      fake.faults.prepare='ok';
      fake.faults.release='reject';
      await assert.rejects(()=>store().releaseCode(CODE,sha256('7'.repeat(64))));
      assert.equal(fake.db.codes[0].reservation_hash,sha256('7'.repeat(64)));
      assert.equal(fake.db.writes.includes('release'),false);
    })();
  }finally{await fake.close();}
}));

test('Dos pedidos a la vez con el mismo código: uno solo, también si repiten token',withEnv({},async()=>{
  const {fake,env,store}=await world();
  seed(fake.db);
  seed(fake.db,{code:'BV-2345-6789'});
  const shared='6'.repeat(64);
  try{
    await withEnv(env,async()=>{
      const [a,b]=await Promise.all(['4','5'].map(token=>handleCheckout(post('/api/checkout',checkoutBody({code:CODE,codeToken:token.repeat(64)})),{store:store(),loadCatalog,recordOrder:async()=>'VIT'})));
      assert.deepEqual([a.status,b.status].sort(),[200,409]);
      assert.equal(fake.db.orders.length,1);
      const parallel=await Promise.all([1,2].map(()=>handleCheckout(post('/api/checkout',checkoutBody({code:'BV-2345-6789',codeToken:shared})),{store:store(),loadCatalog,recordOrder:async()=>'VIT'})));
      const bodies=await Promise.all(parallel.map(response=>response.json()));
      const refs=bodies.filter((_,i)=>parallel[i].status===200).map(body=>body.orderRef);
      assert.equal(new Set(refs).size,1,JSON.stringify(bodies.map(body=>body.orderRef||body.code)));
      assert.equal(fake.db.orders.filter(row=>row.reservation_hash===sha256(shared)).length,1);
      assert.equal(fake.db.codes.find(row=>row.code_hash===sha256('BV-2345-6789')).reservation_hash,sha256(shared));
    })();
  }finally{await fake.close();}
}));
