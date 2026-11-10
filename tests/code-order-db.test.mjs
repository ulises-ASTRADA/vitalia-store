// Postgres y PostgREST locales, datos sintéticos. No es la suite mock (tests/code-retry.test.mjs)
// ni jsdom (tests/ui.test.jsx).
//
// Repetir, con Node 24.x, PostgreSQL 16 y PostgREST 12.2.12:
//   sudo -u postgres createdb vitalia_code_test
//   bash scripts/isolated-coupon-db.sh
// El script crea la base si falta y, si no hay binario, baja PostgREST 12.2.12 a /tmp/postgrest.
// También: POSTGREST_BIN=/ruta/postgrest node --test tests/code-order-db.test.mjs
// VITALIA_ISOLATED_DATABASE_URL puede reemplazar el acceso peer, pero se rechaza si contiene supabase.co o prod.
// Roles anon, authenticated y service_role se crean en este Postgres. No son los de un proyecto remoto.
// La contraseña del authenticator es efímera y queda solo en un config de /tmp.

import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {createHmac, randomBytes} from 'node:crypto';
import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readFile} from 'node:fs/promises';
import {growthStore} from '../server/growth-store.js';
import {handleCheckout} from '../server/checkout.js';
import {sha256} from '../lib/welcome-code.js';

const databaseUrl=process.env.VITALIA_ISOLATED_DATABASE_URL||'';
if(/supabase\.co|prod/i.test(databaseUrl)) throw new Error('La prueba de cupón no puede apuntar a una base remota.');
const database='vitalia_code_test';
const psqlBase=databaseUrl?['psql',databaseUrl]:['sudo','-u','postgres','psql','-d',database];

function spawnSql(extra=[]){
  const cmd=psqlBase[0]==='sudo'
    ?['sudo',['-u','postgres','stdbuf','-oL','-eL','psql','-d',database,...extra]]
    :['stdbuf',['-oL','-eL',...psqlBase,...extra]];
  return spawn(cmd[0],cmd[1],{stdio:['pipe','pipe','pipe']});
}
function runSql(sql){
  return new Promise((resolve,reject)=>{
    const child=spawnSql(['-v','ON_ERROR_STOP=1','-q','-t','-A']);
    let out='',err='';
    child.stdout.on('data',chunk=>{out+=chunk;});
    child.stderr.on('data',chunk=>{err+=chunk;});
    child.on('close',code=>{if(code)reject(new Error(err||out));else resolve(out.trim());});
    child.stdin.end(sql);
  });
}
function openSession(){
  const child=spawnSql(['-v','ON_ERROR_STOP=1']);
  let buf='';
  child.stdout.on('data',chunk=>{buf+=chunk;});
  child.stderr.on('data',chunk=>{buf+=chunk;});
  return {
    async query(sql){
      const token=`READY_${randomBytes(8).toString('hex')}`;
      const start=buf.length;
      child.stdin.write(`${sql.trim().replace(/;$/, '')};\n\\echo ${token}\n`);
      const deadline=Date.now()+15000;
      while(!buf.slice(start).includes(token)){
        if(Date.now()>deadline) throw new Error(`timeout\n${buf.slice(start).slice(-500)}`);
        await new Promise(resolve=>setTimeout(resolve,20));
      }
      return buf.slice(start,buf.indexOf(token,start));
    },
    close(){child.stdin.end();},
  };
}
async function isolated(){
  try{return (await runSql('select current_database();'))===database;}
  catch{return false;}
}
const ready=await isolated();
const postgrestBin=process.env.POSTGREST_BIN||'/tmp/postgrest/postgrest';
let postgrest=null,proxy=null,proxyPort=0,postgrestPort=0,serviceJwt='',jwtSecret='',configDir='';

function jwt(role,secret){
  const header=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
  const payload=Buffer.from(JSON.stringify({role,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');
  const sig=createHmac('sha256',secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}
async function notifySchema(){
  await runSql("notify pgrst, 'reload schema';");
  await new Promise(resolve=>setTimeout(resolve,300));
}
async function seed({code,token=null}){
  const email=`sintetica-${randomBytes(4).toString('hex')}@example.com`;
  const reservation=token?sha256(token):null;
  await runSql(`
    insert into public.vitalia_subscribers (name,email,consent_text,cart_token_hash,unsub_token_hash)
    values ('Prueba','${email}','sintetica','${randomBytes(32).toString('hex')}','${randomBytes(32).toString('hex')}');
    insert into public.vitalia_welcome_codes (subscriber_id,code_hash,expires_at,redeemed_at,reservation_hash)
    values (currval('public.vitalia_subscribers_id_seq'),'${sha256(code)}', now() + interval '1 day',
      ${reservation?'now()':'null'}, ${reservation?`'${reservation}'`:'null'});
  `);
  return {code,token,hash:reservation};
}
function prepareCall(codeHash,reservation,payload,items='[{"id":"A1","quantity":2}]'){
  return `select public.vitalia_prepare_coded_order('${codeHash}','${reservation}','${payload}',3000000,0,0,300000,2700000,false,'${items}'::jsonb, now());`;
}
async function waitLock(application){
  const deadline=Date.now()+5000;
  while(Date.now()<deadline){
    const waiting=await runSql(`select count(*)::text from pg_stat_activity where wait_event_type='Lock' and application_name='${application}' and pid<>pg_backend_pid()`);
    if(waiting==='1')return;
    await new Promise(resolve=>setTimeout(resolve,20));
  }
  throw new Error(`no quedó esperando el bloqueo: ${application}`);
}
const products=[
  {id:'A1',nombre:'Avena de prueba',precio:15000,presentacion:'1 KG',disponibilidad:'ok',activo:true},
  {id:'B2',nombre:'Nuez de prueba',precio:20000,presentacion:'500 GR',disponibilidad:'ok',activo:true},
];
function orderBody(code,token,extra={}){
  return {name:'Ana Prueba',zone:'villa-allende',locality:'',province:'Córdoba',notes:'sintetica',email:'ana@example.com',code,codeToken:token,items:[{id:'A1',quantity:2,expectedPrice:15000}],...extra};
}
async function checkout(store,body,sheets){
  const response=await handleCheckout(new Request(`http://127.0.0.1:${proxyPort}/api/checkout`,{method:'POST',headers:{'content-type':'application/json',origin:`http://127.0.0.1:${proxyPort}`},body:JSON.stringify(body)}),{store,loadCatalog:async()=>({products}),recordOrder:async row=>{sheets.push(row);return 'PLANILLA-LOCAL';}});
  return {status:response.status,body:await response.json()};
}

if(ready){
  const pass=randomBytes(18).toString('hex');
  const secret=jwtSecret=randomBytes(24).toString('hex');
  await runSql(`
    do $$ begin
      if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin noinherit; end if;
      if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin noinherit; end if;
      if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin noinherit bypassrls;
      else alter role service_role nologin noinherit bypassrls; end if;
      if not exists (select 1 from pg_roles where rolname='vitalia_authenticator') then create role vitalia_authenticator login noinherit password '${pass}';
      else alter role vitalia_authenticator login noinherit password '${pass}'; end if;
    end $$;
    grant anon, authenticated, service_role to vitalia_authenticator;
  `);
  await runSql('drop schema if exists public cascade; create schema public;');
  await runSql('grant usage on schema public to anon, authenticated, service_role, vitalia_authenticator;');
  await runSql("create function public.rls_auto_enable() returns void language sql as 'select null'");
  await runSql(await readFile(new URL('../supabase/migrations/20261029120000_vitalia_growth.sql',import.meta.url),'utf8'));
  await runSql(await readFile(new URL('../supabase/migrations/20261110120000_vitalia_order_reservation.sql',import.meta.url),'utf8'));
  serviceJwt=jwt('service_role',secret);
  try{
    const probe=await import('node:fs');
    if(probe.existsSync(postgrestBin)){
      configDir=await mkdtemp(join(tmpdir(),'vitalia-pgrst-'));
      postgrestPort=3411;
      const config=join(configDir,'postgrest.conf');
      await writeFile(config,[
        `db-uri = "postgres://vitalia_authenticator:${pass}@127.0.0.1:5432/${database}"`,
        'db-schemas = "public"',
        'db-anon-role = "anon"',
        `jwt-secret = "${secret}"`,
        `server-port = ${postgrestPort}`,
        'server-host = "127.0.0.1"',
      ].join('\n'),{mode:0o600});
      postgrest=spawn(postgrestBin,[config],{stdio:['ignore','pipe','pipe']});
      let log='';
      postgrest.stdout.on('data',chunk=>{log+=chunk;});
      postgrest.stderr.on('data',chunk=>{log+=chunk;});
      const deadline=Date.now()+8000;
      let up=false;
      while(Date.now()<deadline){
        try{const response=await fetch(`http://127.0.0.1:${postgrestPort}/`); if(response.status<500){up=true;break;}}catch{}
        await new Promise(resolve=>setTimeout(resolve,100));
      }
      if(!up) throw new Error(`PostgREST no arrancó\n${log.slice(-500)}`);
      proxy=createServer(async(req,res)=>{
        const chunks=[];
        for await(const chunk of req)chunks.push(chunk);
        const path=req.url.replace(/^\/rest\/v1/,'')||'/';
        const upstream=await fetch(`http://127.0.0.1:${postgrestPort}${path}`,{method:req.method,headers:{'content-type':req.headers['content-type']||'application/json',...(req.headers.authorization?{authorization:req.headers.authorization}:{}),...(req.headers.apikey?{apikey:req.headers.apikey}:{}),...(req.headers.prefer?{prefer:req.headers.prefer}:{})},body:req.method==='GET'||req.method==='HEAD'?undefined:Buffer.concat(chunks)});
        const text=await upstream.text();
        if(proxy.loseNext&&String(req.url).includes('vitalia_prepare_coded_order')){
          proxy.loseNext=false;
          res.writeHead(500,{'content-type':'application/json'});
          res.end('{"message":"respuesta perdida"}');
          return;
        }
        res.writeHead(upstream.status,{'content-type':upstream.headers.get('content-type')||'application/json'});
        res.end(text);
      });
      await new Promise(resolve=>proxy.listen(0,'127.0.0.1',resolve));
      proxyPort=proxy.address().port;
      process.env.ALLOW_TEST_CHECKOUT='true';
      process.env.WHATSAPP_NUMBER='5491100000000';
      process.env.STORE_NAME='Vitalia';
      process.env.STORE_CURRENCY='ARS';
      process.env.VERCEL='';
    }
  }catch(error){console.error(error);throw error;}
}
test.after(async()=>{
  proxy?.close();
  postgrest?.kill('SIGTERM');
  if(configDir)await rm(configDir,{recursive:true,force:true});
});

test('Base aislada: bloqueo, contenido y migración en limpio',{skip:ready?false:'sin Postgres local vitalia_code_test'},async()=>{
  const codeHash='c'.repeat(64);
  const hold='d'.repeat(64);
  const other='e'.repeat(64);
  const samePayload='1'.repeat(64);
  const otherPayload='2'.repeat(64);
  const defs=await runSql(`select proname || '|' || prosecdef::text || '|' || coalesce(array_to_string(proconfig, ','), '') from pg_proc where proname in ('vitalia_prepare_coded_order','vitalia_release_unmatched_code') order by 1`);
  for(const row of defs.split('\n')){
    assert.match(row,/\|false\|/);
    assert.match(row,/search_path=""/);
  }
  const acl=await runSql(`
    select has_function_privilege('anon', 'public.vitalia_prepare_coded_order(text,text,text,bigint,bigint,bigint,bigint,bigint,boolean,jsonb,timestamptz)'::regprocedure, 'execute')::text
      || has_function_privilege('authenticated', 'public.vitalia_prepare_coded_order(text,text,text,bigint,bigint,bigint,bigint,bigint,boolean,jsonb,timestamptz)'::regprocedure, 'execute')::text
      || has_function_privilege('service_role', 'public.vitalia_prepare_coded_order(text,text,text,bigint,bigint,bigint,bigint,bigint,boolean,jsonb,timestamptz)'::regprocedure, 'execute')::text
      || has_function_privilege('anon', 'public.vitalia_release_unmatched_code(text,text)'::regprocedure, 'execute')::text
      || has_function_privilege('authenticated', 'public.vitalia_release_unmatched_code(text,text)'::regprocedure, 'execute')::text
      || has_function_privilege('service_role', 'public.vitalia_release_unmatched_code(text,text)'::regprocedure, 'execute')::text
      || has_table_privilege('anon', 'public.vitalia_orders', 'select')::text
      || has_table_privilege('authenticated', 'public.vitalia_welcome_codes', 'select')::text
        || (select bool_and(c.relrowsecurity)::text from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname like 'vitalia\\_%')
      || (select count(*)::text from pg_policies where schemaname='public' and tablename like 'vitalia\\_%')
  `);
  assert.equal(acl.replaceAll('\n',''),'falsefalsetruefalsefalsetruefalsefalsetrue0');
  await assert.rejects(()=>runSql('set role anon; select count(*) from public.vitalia_orders;'),/permission denied/i);
  await assert.rejects(()=>runSql('set role authenticated; select count(*) from public.vitalia_welcome_codes;'),/permission denied/i);
  assert.equal(await runSql('set role service_role; select count(*)::text from public.vitalia_orders;'),'0');

  await runSql(`truncate public.vitalia_orders, public.vitalia_welcome_codes, public.vitalia_subscribers restart identity cascade;`);
  await runSql(`
    insert into public.vitalia_subscribers (name,email,consent_text,cart_token_hash,unsub_token_hash)
    values ('Prueba','aislada@example.com','ok','${'a'.repeat(64)}','${'b'.repeat(64)}');
    insert into public.vitalia_welcome_codes (subscriber_id, code_hash, expires_at)
    values (1, '${codeHash}', now() + interval '1 day');
  `);
  await runSql(`
    do $$ begin
      if exists (select 1 from pg_roles where rolname='vitalia_rls_probe') then
        execute 'revoke all on all tables in schema public from vitalia_rls_probe';
        execute 'revoke all on schema public from vitalia_rls_probe';
        execute 'drop role vitalia_rls_probe';
      end if;
    end $$;
    create role vitalia_rls_probe nologin;
    grant usage on schema public to vitalia_rls_probe;
    grant select on public.vitalia_orders to vitalia_rls_probe;
  `);
  try{
    await runSql(`insert into public.vitalia_orders (subtotal_cents,suggestion_cents,bulk_cents,code_cents,total_cents,free_shipping,used_code,items) values (1,0,0,0,1,false,false,'[{"id":"A1","quantity":1}]'::jsonb);`);
    assert.equal(await runSql('set role vitalia_rls_probe; select count(*)::text from public.vitalia_orders;'),'0');
  }finally{
    await runSql(`
      reset role;
      revoke all on table public.vitalia_orders from vitalia_rls_probe;
      revoke all on schema public from vitalia_rls_probe;
      drop role if exists vitalia_rls_probe;
      delete from public.vitalia_orders;
    `);
  }

  const holder=openSession();
  const waiter=openSession();
  try{
    await holder.query('begin');
    await holder.query(`select id from public.vitalia_welcome_codes where code_hash='${codeHash}' for update`);
    const pending=waiter.query(`set application_name to 'vitalia_release'; select public.vitalia_release_unmatched_code('${codeHash}','${hold}')`);
    await waitLock('vitalia_release');
    await holder.query(`
      update public.vitalia_welcome_codes set redeemed_at=now(), reservation_hash='${hold}' where code_hash='${codeHash}';
      insert into public.vitalia_orders (subtotal_cents,suggestion_cents,bulk_cents,code_cents,total_cents,free_shipping,used_code,items,reservation_hash,payload_hash)
      values (3000000,0,0,300000,2700000,false,true,'[{"id":"A1","quantity":2}]'::jsonb,'${hold}','${samePayload}')
    `);
    await holder.query('commit');
    assert.match(await pending,/kept/);
    assert.equal(await runSql(`select (select count(*) from public.vitalia_orders)::text || '|' || (select (redeemed_at is not null)::text from public.vitalia_welcome_codes)`),'1|true');
  }finally{holder.close();waiter.close();}

  await runSql('delete from public.vitalia_orders; update public.vitalia_welcome_codes set redeemed_at=now(), reservation_hash='+"'"+hold+"'"+';');
  const maker=openSession();
  const rival=openSession();
  try{
    await maker.query('begin');
    await maker.query(`select id from public.vitalia_welcome_codes where code_hash='${codeHash}' for update`);
    const creating=rival.query(`set application_name to 'vitalia_prepare'; ${prepareCall(codeHash,hold,samePayload)}`);
    await waitLock('vitalia_prepare');
    await maker.query(`select public.vitalia_release_unmatched_code('${codeHash}','${hold}')`);
    await maker.query('commit');
    assert.match(await creating,/created/);
    assert.equal(await runSql(`select count(*)::text || '|' || (select (redeemed_at is not null)::text from public.vitalia_welcome_codes) from public.vitalia_orders`),'1|true');
  }finally{maker.close();rival.close();}

  await runSql('delete from public.vitalia_orders; update public.vitalia_welcome_codes set redeemed_at=null, reservation_hash=null;');
  const first=openSession();
  const second=openSession();
  try{
    await first.query('begin');
    await first.query(`select id from public.vitalia_welcome_codes where code_hash='${codeHash}' for update`);
    const same=second.query(`set application_name to 'vitalia_same'; ${prepareCall(codeHash,hold,samePayload)}`);
    await waitLock('vitalia_same');
    await first.query(prepareCall(codeHash,hold,samePayload));
    await first.query('commit');
    assert.match(await same,/exists/);
    assert.equal(await runSql('select count(*)::text from public.vitalia_orders'),'1');
  }finally{first.close();second.close();}

  const changed=await runSql(prepareCall(codeHash,hold,otherPayload));
  assert.match(changed,/mismatch/);
  const stranger=await runSql(prepareCall(codeHash,other,samePayload));
  assert.match(stranger,/used/);
  assert.equal(await runSql('select count(*)::text from public.vitalia_orders'),'1');
  assert.equal(await runSql(`select items->0->>'quantity' from public.vitalia_orders`),'2');

  await runSql('delete from public.vitalia_orders; update public.vitalia_welcome_codes set redeemed_at=null, reservation_hash=null;');
  const left=openSession();
  const right=openSession();
  try{
    await left.query('begin');
    await left.query(`select id from public.vitalia_welcome_codes where code_hash='${codeHash}' for update`);
    const otherToken=right.query(`set application_name to 'vitalia_other'; ${prepareCall(codeHash,other,otherPayload)}`);
    await waitLock('vitalia_other');
    await left.query(prepareCall(codeHash,hold,samePayload));
    await left.query('commit');
    assert.match(await otherToken,/used/);
    assert.equal(await runSql('select count(*)::text from public.vitalia_orders'),'1');
  }finally{left.close();right.close();}

  await runSql('delete from public.vitalia_orders; update public.vitalia_welcome_codes set redeemed_at=null, reservation_hash=null;');
  await assert.rejects(()=>runSql(prepareCall(codeHash,hold,samePayload,'[]')),/check constraint|violates/i);
  assert.equal(await runSql(`select (select count(*) from public.vitalia_orders)::text || '|' || (select (redeemed_at is null)::text from public.vitalia_welcome_codes)`),'0|true');
});

test('PostgREST local: permisos, pedido real y esquema sin la migración',{skip:ready&&postgrest?false:ready?'sin binario de PostgREST':'sin Postgres local vitalia_code_test'},async()=>{
  assert.equal(postgrestPort>0&&proxyPort>0,true);
  const store=growthStore({SUPABASE_URL:`http://127.0.0.1:${proxyPort}`,SUPABASE_SERVICE_ROLE_KEY:serviceJwt,VERCEL:''});
  assert.equal(store.mode,'supabase');
  const rpcBody=JSON.stringify({p_code_hash:'c'.repeat(64),p_reservation_hash:'d'.repeat(64),p_payload_hash:'1'.repeat(64),p_subtotal_cents:1,p_suggestion_cents:0,p_bulk_cents:0,p_code_cents:0,p_total_cents:1,p_free_shipping:false,p_items:[{id:'A1',quantity:1}],p_at:new Date().toISOString()});
  const anonCall=await fetch(`http://127.0.0.1:${postgrestPort}/rpc/vitalia_prepare_coded_order`,{method:'POST',headers:{'content-type':'application/json'},body:rpcBody});
  assert.notEqual(anonCall.status,200);
  assert.match(await anonCall.text(),/permission denied/i);
  const signed=await fetch(`http://127.0.0.1:${postgrestPort}/rpc/vitalia_release_unmatched_code`,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${jwt('authenticated',jwtSecret)}`},body:JSON.stringify({p_code_hash:'c'.repeat(64),p_reservation_hash:'d'.repeat(64)})});
  assert.notEqual(signed.status,200);
  assert.match(await signed.text(),/permission denied/i);
  assert.equal(await runSql('select count(*)::text from public.vitalia_orders'),'0');

  await runSql('truncate public.vitalia_orders, public.vitalia_welcome_codes, public.vitalia_subscribers restart identity cascade;');
  const code='BV-7K2Q-9MXD';
  const token='a'.repeat(64);
  await seed({code,token:null});
  const sheets=[];
  const created=await checkout(store,orderBody(code,token),sheets);
  assert.equal(created.status,200,JSON.stringify(created.body));
  assert.match(created.body.orderRef,/^V-/);
  assert.match(created.body.message,/Ana Prueba/);
  assert.match(created.body.whatsappUrl,/wa\.me/);
  const again=await checkout(store,orderBody(code,token),sheets);
  assert.equal(again.status,200);
  assert.equal(again.body.orderRef,created.body.orderRef);
  assert.equal(again.body.message,created.body.message);
  assert.equal(sheets.length,1);

  for(const [label,extra] of [
    ['cantidad',{items:[{id:'A1',quantity:3,expectedPrice:15000}]}],
    ['producto',{items:[{id:'B2',quantity:1,expectedPrice:20000}]}],
    ['nombre',{name:'Ana Otra'}],
    ['mail',{email:'otra@example.com'}],
    ['zona',{zone:'unquillo',locality:''}],
  ]){
    const changed=await checkout(store,orderBody(code,token,extra),sheets);
    assert.equal(changed.status,409,label);
    assert.equal(changed.body.code,'ORDER_MISMATCH',label);
    assert.equal(changed.body.whatsappUrl,undefined,label);
    assert.equal(changed.body.message,undefined,label);
    assert.equal(sheets.length,1,label);
  }
  assert.equal(await runSql(`select items->0->>'id' || ':' || (items->0->>'quantity') from public.vitalia_orders`),'A1:2');
  assert.equal(await runSql('select count(*)::text from public.vitalia_orders'),'1');

  const other=await checkout(store,orderBody(code,'b'.repeat(64)),sheets);
  assert.equal(other.status,409);
  assert.equal(other.body.code,'CODE_USED');
  assert.equal(sheets.length,1);

  const parallelCode='BV-7K2Q-9MXE';
  const parallelToken='c'.repeat(64);
  await seed({code:parallelCode});
  const parallelSheets=[];
  const pair=await Promise.all([
    checkout(store,orderBody(parallelCode,parallelToken),parallelSheets),
    checkout(store,orderBody(parallelCode,parallelToken),parallelSheets),
  ]);
  assert.deepEqual(pair.map(item=>item.status).sort(),[200,200]);
  assert.equal(pair[0].body.orderRef,pair[1].body.orderRef);
  assert.equal(pair[0].body.message,pair[1].body.message);
  assert.equal(parallelSheets.length,1);
  assert.equal(await runSql(`select count(*)::text from public.vitalia_orders where reservation_hash='${sha256(parallelToken)}'`),'1');

  const rivalCode='BV-7K2Q-9MXF';
  await seed({code:rivalCode});
  const rivalSheets=[];
  const rivals=await Promise.all([
    checkout(store,orderBody(rivalCode,'d'.repeat(64)),rivalSheets),
    checkout(store,orderBody(rivalCode,'e'.repeat(64)),rivalSheets),
  ]);
  assert.equal(rivals.filter(item=>item.status===200).length,1);
  assert.equal(rivals.filter(item=>item.status===409&&item.body.code==='CODE_USED').length,1);
  assert.equal(rivalSheets.length,1);
  assert.equal(await runSql(`select count(*)::text from public.vitalia_orders where reservation_hash in ('${sha256('d'.repeat(64))}','${sha256('e'.repeat(64))}')`),'1');

  const lostCode='BV-7K2Q-9MXG';
  const lostToken='f'.repeat(64);
  await seed({code:lostCode});
  proxy.loseNext=true;
  const lostSheets=[];
  const lost=await checkout(store,orderBody(lostCode,lostToken),lostSheets);
  assert.equal(lost.status,503);
  assert.equal(lost.body.code,'UNAVAILABLE');
  assert.equal(lost.body.whatsappUrl,undefined);
  assert.equal(lostSheets.length,0);
  assert.equal(await runSql(`select count(*)::text from public.vitalia_orders where reservation_hash='${sha256(lostToken)}'`),'1');
  assert.equal(await runSql(`select (redeemed_at is not null)::text from public.vitalia_welcome_codes where code_hash='${sha256(lostCode)}'`),'true');
  const recovered=await checkout(store,orderBody(lostCode,lostToken),lostSheets);
  assert.equal(recovered.status,200);
  // La base ya commiteó antes de perder la respuesta. El reintento reconoce el pedido y no escribe otra fila:
  // no hay forma de saber si una planilla anterior llegó, así que no se rellena en este camino.
  assert.equal(lostSheets.length,0);
  const recoveredAgain=await checkout(store,orderBody(lostCode,lostToken),lostSheets);
  assert.equal(recoveredAgain.body.orderRef,recovered.body.orderRef);
  assert.equal(recoveredAgain.body.message,recovered.body.message);
  assert.match(recovered.body.message,/Ana Prueba/);
  assert.equal(lostSheets.length,0);
  assert.equal(await runSql(`select count(*)::text from public.vitalia_orders where reservation_hash='${sha256(lostToken)}'`),'1');

  const bareFree='BV-7K2Q-9MXH';
  const bareHeld='BV-7K2Q-9MXJ';
  const heldToken='9'.repeat(64);
  await seed({code:bareFree});
  await seed({code:bareHeld,token:heldToken});
  await runSql(`
    drop function if exists public.vitalia_prepare_coded_order(text,text,text,bigint,bigint,bigint,bigint,bigint,boolean,jsonb,timestamptz);
    drop function if exists public.vitalia_release_unmatched_code(text,text);
    alter table public.vitalia_orders drop column if exists reservation_hash;
    alter table public.vitalia_orders drop column if exists payload_hash;
    drop index if exists vitalia_orders_reservation_hash_key;
  `);
  await notifySchema();
  const beforeOrders=await runSql('select count(*)::text from public.vitalia_orders');
  const closedSheets=[];
  const closed=await checkout(store,orderBody(bareFree,'8'.repeat(64)),closedSheets);
  assert.equal(closed.status,503);
  assert.equal(closedSheets.length,0);
  assert.equal(await runSql('select count(*)::text from public.vitalia_orders'),beforeOrders);
  assert.equal(await runSql(`select (redeemed_at is null)::text from public.vitalia_welcome_codes where code_hash='${sha256(bareFree)}'`),'true');
  const heldClosed=await checkout(store,orderBody(bareHeld,heldToken),closedSheets);
  assert.equal(heldClosed.status,503);
  assert.equal(await runSql(`select (reservation_hash='${sha256(heldToken)}')::text from public.vitalia_welcome_codes where code_hash='${sha256(bareHeld)}'`),'true');
  assert.equal(await runSql('select count(*)::text from public.vitalia_orders'),beforeOrders);
  try{
    await runSql(await readFile(new URL('../supabase/migrations/20261110120000_vitalia_order_reservation.sql',import.meta.url),'utf8'));
    await notifySchema();
    const after=await checkout(store,orderBody(bareHeld,heldToken),closedSheets);
    assert.equal(after.status,200,JSON.stringify(after.body));
    assert.equal(closedSheets.length,1);
    const afterAgain=await checkout(store,orderBody(bareHeld,heldToken),closedSheets);
    assert.equal(afterAgain.body.orderRef,after.body.orderRef);
    assert.equal(afterAgain.body.message,after.body.message);
    assert.equal(closedSheets.length,1);
    assert.equal(await runSql(`select count(*)::text from public.vitalia_orders where reservation_hash='${sha256(heldToken)}'`),'1');
    const serviceRows=await fetch(`http://127.0.0.1:${postgrestPort}/vitalia_orders?reservation_hash=eq.${sha256(heldToken)}&select=ref`,{headers:{authorization:`Bearer ${jwt('service_role',jwtSecret)}`,accept:'application/json'}});
    assert.equal(serviceRows.status,200);
    assert.equal((await serviceRows.json()).length,1);
    const anonRows=await fetch(`http://127.0.0.1:${postgrestPort}/vitalia_orders?select=ref`);
    assert.notEqual(anonRows.status,200);
    assert.match(await anonRows.text(),/permission denied/i);
  }finally{
    await runSql(await readFile(new URL('../supabase/migrations/20261110120000_vitalia_order_reservation.sql',import.meta.url),'utf8')).catch(()=>{});
    await notifySchema();
  }
});
