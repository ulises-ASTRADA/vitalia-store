import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';

const database=process.env.VITALIA_ISOLATED_DATABASE_URL||'';
if(/supabase\.co|prod/i.test(database)) throw new Error('La prueba de cupón no puede apuntar a una base remota.');
const psqlArgs=database?['psql',database]:['sudo','-u','postgres','psql','-d','vitalia_code_test'];
const bin=psqlArgs[0];
const args=psqlArgs.slice(1);

function runSql(sql){
  return new Promise((resolve,reject)=>{
    const child=spawn(bin,[...args,'-v','ON_ERROR_STOP=1','-q','-t','-A'],{stdio:['pipe','pipe','pipe']});
    let out='',err='';
    child.stdout.on('data',chunk=>{out+=chunk;});
    child.stderr.on('data',chunk=>{err+=chunk;});
    child.on('close',code=>{if(code)reject(new Error(err||out));else resolve(out.trim());});
    child.stdin.end(sql);
  });
}
function openSession(){
  const child=spawn(bin,[...args,'-v','ON_ERROR_STOP=1'],{stdio:['pipe','pipe','pipe']});
  let buf='';
  child.stdout.on('data',chunk=>{buf+=chunk;});
  child.stderr.on('data',chunk=>{buf+=chunk;});
  return {
    async query(sql){
      const token=`READY_${Math.random().toString(16).slice(2)}`;
      const start=buf.length;
      child.stdin.write(`${sql}\n\\echo ${token}\n`);
      const deadline=Date.now()+8000;
      while(!buf.slice(start).includes(token)){
        if(Date.now()>deadline) throw new Error(`timeout\n${buf.slice(start)}`);
        await new Promise(resolve=>setTimeout(resolve,20));
      }
      return buf.slice(start,buf.indexOf(token,start));
    },
    close(){child.stdin.end();},
  };
}
async function isolated(){
  try{const name=await runSql('select current_database()');return name==='vitalia_code_test';}
  catch{return false;}
}
const ready=await isolated();

test('Base aislada: crear y liberar no dejan un cupón libre con pedido',{skip:ready?false:'sin Postgres local vitalia_code_test'},async()=>{
  const migration=await readFile(new URL('../supabase/migrations/20261110120000_vitalia_order_reservation.sql',import.meta.url),'utf8');
  await runSql(migration);
  await runSql(`
    truncate public.vitalia_orders, public.vitalia_welcome_codes, public.vitalia_subscribers restart identity cascade;
    insert into public.vitalia_subscribers (name,email,consent_text,cart_token_hash,unsub_token_hash)
    values ('Prueba','aislada@example.com','ok', repeat('a',64), repeat('b',64));
  `);
  const codeHash='c'.repeat(64);
  const hold='d'.repeat(64);
  const other='e'.repeat(64);
  const samePayload='1'.repeat(64);
  const otherPayload='2'.repeat(64);
  const items=`[{"id":"A","quantity":1}]`;
  async function seedFree(){
    await runSql(`
      delete from public.vitalia_orders;
      delete from public.vitalia_welcome_codes;
      insert into public.vitalia_welcome_codes (subscriber_id, code_hash, expires_at)
      values (1, '${codeHash}', now() + interval '1 day');
    `);
  }
  const call=(hash,payload)=>`select public.vitalia_prepare_coded_order('${codeHash}','${hash}','${payload}',1000,0,0,100,900,false,'${items}'::jsonb, now());`;

  await seedFree();
  const holder=openSession();
  const waiter=openSession();
  try{
    await holder.query('begin;');
    await holder.query(`select id from public.vitalia_welcome_codes where code_hash='${codeHash}' for update;`);
    const pending=waiter.query(`select public.vitalia_release_unmatched_code('${codeHash}','${hold}');`);
    const deadline=Date.now()+4000;
    let waiting='0';
    while(waiting!=='1'){
      if(Date.now()>deadline) throw new Error('la liberación no quedó esperando el bloqueo');
      waiting=await runSql(`select count(*)::text from pg_stat_activity where wait_event_type='Lock' and query like '%vitalia_release_unmatched_code%' and query not like '%pg_stat_activity%'`);
      await new Promise(resolve=>setTimeout(resolve,20));
    }
    await holder.query(`
      update public.vitalia_welcome_codes set redeemed_at=now(), reservation_hash='${hold}' where code_hash='${codeHash}';
      insert into public.vitalia_orders (subtotal_cents,suggestion_cents,bulk_cents,code_cents,total_cents,free_shipping,used_code,items,reservation_hash,payload_hash)
      values (1000,0,0,100,900,false,true,'${items}'::jsonb,'${hold}','${samePayload}');
    `);
    await holder.query('commit;');
    const released=await pending;
    assert.match(released,/kept/);
    const state=await runSql(`select (select count(*) from public.vitalia_orders)::text || '|' || (select (redeemed_at is not null)::text from public.vitalia_welcome_codes)`);
    assert.equal(state,'1|true');
  }finally{holder.close();waiter.close();}

  await seedFree();
  const first=await runSql(call(hold,samePayload));
  assert.match(first,/created/);
  const same=await runSql(call(hold,samePayload));
  assert.match(same,/exists/);
  const changed=await runSql(call(hold,otherPayload));
  assert.match(changed,/mismatch/);
  const stranger=await runSql(call(other,samePayload));
  assert.match(stranger,/used/);
  const after=await runSql(`select count(*)::text from public.vitalia_orders`);
  assert.equal(after,'1');
  const still=await runSql(`select (redeemed_at is not null)::text from public.vitalia_welcome_codes`);
  assert.equal(still,'true');

  await seedFree();
  const maker=openSession();
  const rival=openSession();
  try{
    await maker.query('begin;');
    await maker.query(`select id from public.vitalia_welcome_codes where code_hash='${codeHash}' for update;`);
    const creating=rival.query(call(other,otherPayload));
    await maker.query(`select public.vitalia_prepare_coded_order('${codeHash}','${hold}','${samePayload}',1000,0,0,100,900,false,'${items}'::jsonb, now());`);
    await maker.query('commit;');
    const rivalResult=await creating;
    assert.match(rivalResult,/used/);
    assert.equal(await runSql('select count(*)::text from public.vitalia_orders'),'1');
  }finally{maker.close();rival.close();}
});
