import {test} from 'node:test';
import assert from 'node:assert/strict';
import {allowedOrigin,limitRequest} from '../lib/request-security.js';
import {storeSettings} from '../lib/catalog.js';

test('Checkout exige Origin autorizado aunque Host esté manipulado',()=>{
 const request=(origin,host='evil.example')=>new Request('https://www.vitalia.energy/api/checkout',{headers:{...(origin?{origin}:{}),host}});
 assert.equal(allowedOrigin(request()),false);
 assert.equal(allowedOrigin(request('null')),false);
 assert.equal(allowedOrigin(request('https://evil.example')),false);
 assert.equal(allowedOrigin(request('https://www.vitalia.energy')),true);
 assert.equal(allowedOrigin(request('https://vitalia.energy')),true);
 assert.equal(allowedOrigin(request('https://www.vitalia.energy.evil.example')),false);
});
test('Límite devuelve 429 y Retry-After, separado por ruta y reinicia al vencer',()=>{
 const r=new Request('https://www.vitalia.energy/api/catalog');
 assert.equal(limitRequest(r,'test-catalog',2,1000),null);
 assert.equal(limitRequest(r,'test-catalog',2,1001),null);
 const denied=limitRequest(r,'test-catalog',2,1002);
 assert.equal(denied.status,429);assert.equal(denied.headers.get('retry-after'),'60');
 assert.equal(limitRequest(r,'test-checkout',2,1002),null);
 assert.equal(limitRequest(r,'test-catalog',2,61000),null);
});
test('Producción ignora ALLOW_TEST_CHECKOUT incluso si quedó activado',()=>{
 const saved={...process.env};
 try{process.env.VERCEL_ENV='production';process.env.ALLOW_TEST_CHECKOUT='true';assert.equal(storeSettings().testCheckout,false);}
 finally{process.env=saved;}
});
