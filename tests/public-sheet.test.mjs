import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePublicSheet,normalizeRows,getCatalog} from '../lib/catalog.js';
const fixture={status:'ok',table:{cols:['id','nombre','precio','activo','descripcion'].map(label=>({label})),rows:[{c:[{v:'N001'},{v:'Almendra, "natural"'},{v:16500,f:'$16.500,00'},{v:true},{v:'Una línea\nOtra línea'}]},{c:[{v:'N161'},{v:'Oculto'},{v:100},{v:false},null]}]}};
const response='/*O_o*/\ngoogle.visualization.Query.setResponse('+JSON.stringify(fixture)+');';
test('Sheets público conserva números, booleanos y texto multilínea',()=>{
 const products=normalizeRows(parsePublicSheet(response));
 assert.equal(products.length,1);assert.equal(products[0].precio,16500);
 assert.equal(products[0].nombre,'Almendra, "natural"');assert.equal(products[0].descripcion,'Una línea\nOtra línea');
});
test('Sheets público rechaza login HTML y errores del proveedor',()=>{
 assert.throws(()=>parsePublicSheet('<html>Login</html>'));
 assert.throws(()=>parsePublicSheet('google.visualization.Query.setResponse({"status":"error"});'));
});
test('Lectura pública no solicita token y checkout fresco rechaza falta de acceso',async()=>{
 const keys=['GOOGLE_SHEETS_PUBLIC','GOOGLE_SHEETS_ID','PREVIEW_MODE'];
 const old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));const originalFetch=globalThis.fetch;
 process.env.GOOGLE_SHEETS_PUBLIC='true';process.env.GOOGLE_SHEETS_ID='test';process.env.PREVIEW_MODE='false';
 try {
  globalThis.fetch=async (url,options)=>{assert.equal(new URL(url).hostname,'docs.google.com');assert.equal(options.headers,undefined);assert.equal(options.cache,'no-store');return new Response(response);};
  assert.equal((await getCatalog({fresh:true})).source,'sheets');
  globalThis.fetch=async()=>new Response('<html>Login</html>');
  await assert.rejects(getCatalog({fresh:true}));
 } finally {globalThis.fetch=originalFetch;for(const k of keys){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}}
});
