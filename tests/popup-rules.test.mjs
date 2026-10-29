import test from 'node:test';
import assert from 'node:assert/strict';
import {POPUP_DELAY_MS,canShowPopup,isQuietPath,triggerAllowed} from '../lib/popup-rules.js';

const DAY=86400000,now=Date.UTC(2026,9,29);
const base={path:'/',now,dismissedAt:null,subscribed:null,search:'',shownThisSession:false,otherDialogOpen:false};

test('Nunca en carrito ni checkout',()=>{
  assert.equal(canShowPopup({...base,path:'/checkout'}),false);
  assert.equal(triggerAllowed({trigger:'time',path:'/checkout',elapsedMs:60000}),false);
  assert.equal(triggerAllowed({trigger:'scroll',path:'/checkout',scrollRatio:1}),false);
  assert.equal(canShowPopup(base),true);
});
test('A los 25–30 s o al 50% de scroll',()=>{
  assert.ok(POPUP_DELAY_MS>=25000&&POPUP_DELAY_MS<=30000);
  assert.equal(triggerAllowed({trigger:'time',path:'/',elapsedMs:POPUP_DELAY_MS-1}),false);
  assert.equal(triggerAllowed({trigger:'time',path:'/',elapsedMs:POPUP_DELAY_MS}),true);
  assert.equal(triggerAllowed({trigger:'scroll',path:'/',scrollRatio:.49}),false);
  assert.equal(triggerAllowed({trigger:'scroll',path:'/',scrollRatio:.5}),true);
});
test('Intención de salida solo en escritorio y nunca en ficha de producto ni /envios',()=>{
  assert.equal(triggerAllowed({trigger:'exit',path:'/',desktop:true}),true);
  assert.equal(triggerAllowed({trigger:'exit',path:'/',desktop:false}),false);
  for(const path of ['/productos/granola-n037','/envios']){
    assert.equal(isQuietPath(path),true);
    assert.equal(triggerAllowed({trigger:'exit',path,desktop:true}),false);
    // De entrada no aparece: hace falta tiempo o scroll real.
    assert.equal(triggerAllowed({trigger:'time',path,elapsedMs:0}),false);
  }
});
test('Cerrado: no vuelve por 30 días',()=>{
  assert.equal(canShowPopup({...base,dismissedAt:String(now-29*DAY)}),false);
  assert.equal(canShowPopup({...base,dismissedAt:String(now-30*DAY)}),true);
});
test('Suscripto o visitante de un mail: nunca',()=>{
  assert.equal(canShowPopup({...base,subscribed:'1'}),false);
  assert.equal(canShowPopup({...base,search:'?utm_source=x&utm_medium=email'}),false);
});
test('Una vez por sesión y nunca sobre otro diálogo',()=>{
  assert.equal(canShowPopup({...base,shownThisSession:true}),false);
  assert.equal(canShowPopup({...base,otherDialogOpen:true}),false);
});
