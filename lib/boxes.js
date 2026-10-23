const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const nameMatches=pattern=>p=>pattern.test(normalize(p.nombre));
const groups={
  granola:nameMatches(/^granola/),
  oats:nameMatches(/^avena/),
  nuts:p=>p.categoria==='Frutos secos y semillas'&&/almendra|nuez|nueces|castana|avellana|pistacho|mani/.test(normalize(`${p.nombre} ${p.descripcion}`)),
  seeds:nameMatches(/^semilla|^sesamo|^chia|^lino/),
  peanut:nameMatches(/pasta de mani|mantequilla de mani/),
  tea:p=>p.categoria==='Infusiones',
  bars:p=>p.categoria==='Barritas',
  snacks:p=>p.categoria==='Snacks',
  protein:nameMatches(/proteic|proteina/)
};
export const BOXES=[
  {id:'breakfast',name:'BOX Vitalia',occasion:'Desayuno y merienda',description:'Granolas, avena, frutos secos, semillas, pasta de maní e infusiones.',image:'/images/boxes/vitalia.webp',groups:['granola','oats','nuts','seeds','peanut','tea']},
  {id:'work',name:'Vitalia Work',occasion:'Trabajo y estudio',description:'Barritas, frutos secos, snacks e infusiones para tus pausas.',image:'/images/boxes/work.webp',groups:['bars','nuts','snacks','tea']},
  {id:'energy',name:'Box Enérgico',occasion:'Actividad física',description:'Frutos secos, barritas, semillas y productos proteicos del catálogo.',image:'/images/boxes/energy.webp',groups:['nuts','bars','seeds','protein']}
];
export const BOX_GOALS=[
  {id:'breakfast',label:'Resolver desayunos y meriendas'},
  {id:'work',label:'Tener snacks para el trabajo o estudio'},
  {id:'energy',label:'Acompañar mi actividad física'},
  {id:'discover',label:'Probar productos nuevos'},
  {id:'gift',label:'Hacer un regalo'}
];
export function buildBox(products,{goal='breakfast',profile='breakfast',taste='varied',budget=null,avoid=''}={}){
  const definition=BOXES.find(box=>box.id===goal)||BOXES.find(box=>box.id===profile)||BOXES[0];
  const excluded=normalize(avoid).split(/[,;\n]/).map(word=>word.trim()).filter(Boolean);
  const salty=/salad|picante|jamon|pizza|barbacoa|frito|cervecero|queso|oregano|finas hierbas|\bhot\b/;
  const sweet=/chocolate|dulce|miel|banana|granola|barrita|pasas|arandano|cookie|pepas|azucarad/;
  const available=products.filter(p=>p.activo!==false&&p.disponibilidad!=='agotado'&&p.presentacion&&Number.isFinite(p.precio)&&p.precio>0).filter(p=>{
    const text=normalize(`${p.nombre} ${p.descripcion}`);
    if(excluded.some(word=>text.includes(word)))return false;
    if(taste==='sweet'&&salty.test(text))return false;
    if(taste==='salty'&&sweet.test(text))return false;
    return true;
  }).sort((a,b)=>Math.round(a.precio*100)-Math.round(b.precio*100)||a.id.localeCompare(b.id));
  const limit=budget===null?Infinity:Math.round(Number(budget)*100);
  if(!(limit>0))return {products:[],total:0,minimum:null,definition};
  const selected=[];let total=0;
  for(const group of definition.groups){
    const product=available.find(p=>groups[group](p)&&!selected.some(s=>s.id===p.id)&&total+Math.round(p.precio*100)<=limit);
    if(product){selected.push(product);total+=Math.round(product.precio*100);}
  }
  const eligible=available.filter(p=>definition.groups.some(group=>groups[group](p)));
  return {products:selected,total:total/100,minimum:eligible.length?eligible[0].precio:null,definition};
}
