import assert from 'node:assert/strict';
import {test} from 'node:test';
import {rankProducts,searchSuggestions,matchesQuery,searchResultsPath,normalize} from '../lib/search.js';
import {notFoundFeatured} from '../lib/not-found.js';

const products=[
  {id:'N010',nombre:'Mix tropical',categoria:'Frutos secos y semillas',presentacion:'1 KG',descripcion:''},
  {id:'N011',nombre:'Granola',categoria:'Cereales',presentacion:'500 GR',descripcion:'Con frutos secos'},
  {id:'N012',nombre:'Frutos rojos deshidratados',categoria:'Frutas',presentacion:'250 GR',descripcion:''},
  {id:'N013',nombre:'Barrita de frutos',categoria:'Barritas',presentacion:'1 U',descripcion:''},
  {id:'N014',nombre:'Té verde',categoria:'Infusiones',presentacion:'500 GR',descripcion:''}
];

test('Búsqueda: una sola función ordena la grilla y las sugerencias',()=>{
  const ranked=rankProducts(products,'frutos').map(p=>p.id);
  // Nombre que empieza > nombre que contiene > categoría > descripción; empate por orden del catálogo.
  assert.deepEqual(ranked,['N012','N013','N010','N011']);
  assert.deepEqual(searchSuggestions(products,'frutos').map(p=>p.id),ranked);
  assert.equal(searchSuggestions(products,'Frutos')[0].id,rankProducts(products,'Frutos')[0].id);
  // El nombre exacto no se sugiere, pero sigue en la grilla.
  assert.deepEqual(searchSuggestions(products,'te verde'),[]);
  assert.deepEqual(rankProducts(products,'te verde').map(p=>p.id),['N014']);
  assert.deepEqual(rankProducts(products,'frutos',{category:'Barritas'}).map(p=>p.id),['N013']);
  assert.equal(rankProducts(products,'').length,products.length);
  assert.equal(matchesQuery(products[4],'TÉ'),true);assert.equal(normalize('Té'),'te');
});

test('Búsqueda: Enter fuera de la home va a /?q=término (nunca /catalogo)',()=>{
  assert.equal(searchResultsPath('frutos'),'/?q=frutos');
  assert.equal(searchResultsPath('  frutos secos '),'/?q=frutos%20secos');
  assert.equal(searchResultsPath(''),'/');
});

test('404: 4 destacados determinísticos con precio, foto y stock',()=>{
  const list=[{id:'A1',precio:0,imagen:'/a'},{id:'A2',precio:10,imagen:'/b',disponibilidad:'agotado'},...Array.from({length:6},(_,i)=>({id:`B${i}`,precio:10,imagen:'/x'}))];
  assert.deepEqual(notFoundFeatured(list).map(p=>p.id),['B0','B1','B2','B3']);
  assert.deepEqual(notFoundFeatured(null),[]);
});

