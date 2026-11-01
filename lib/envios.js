// Datos de /envios (Fase 1, spec §5). Solo datos confirmados por la tienda (28/10).
// Una sola lista de costos arma las secciones por zona, la tabla de costos, las FAQ y el JSON-LD.

export const ENVIOS_PATH='/envios';
export const ENVIOS_TITLE='Envíos a Sierras Chicas y zona norte de Córdoba';
export const ENVIOS_META_TITLE=`${ENVIOS_TITLE} | Vitalia`;
// Meta aprobada por SEO (exacta).
export const ENVIOS_DESCRIPTION='Llevamos tu pedido de la dietética a Villa Allende, Unquillo, Río Ceballos, Mendiolaza, La Calera, Saldán y zona norte de Córdoba.';
import {INSTAGRAM_URL,INSTAGRAM_HANDLE} from './social.js';
export {INSTAGRAM_URL,INSTAGRAM_HANDLE};
export const PAYMENT_METHODS=['Transferencia','Efectivo'];
export const FREE_SHIPPING_FROM=70000;
export const PICKUP_LOCALITY='Villa Allende';

// Dirección del retiro: NO se publica hasta confirmar si es un local (pedido de Sentinel, 28/10).
// Para publicarla, poné acá la calle y el número (texto). Con null no aparece en el HTML, el JSON-LD,
// llms.txt ni hay link a Google Maps.
export const PICKUP_ADDRESS=null;

// Costo por zona, en pesos. Es la única fuente de los montos de la página.
export const SHIPPING_COST={
  'villa-allende':3000,mendiolaza:3000,saldan:3000,'villa-rivera-indarte':3000,
  'rio-ceballos':5000,unquillo:5000,'la-calera':5000,arguello:5000,'cerro-de-las-rosas':5000
};

// Orden de la tabla y de las FAQ de costos (por costo, como en el spec).
const COST_ORDER=['villa-allende','mendiolaza','saldan','villa-rivera-indarte','rio-ceballos','unquillo','la-calera','arguello','cerro-de-las-rosas'];
// Orden de la respuesta directa y de "¿A qué zonas…?" (el mismo que areaServed).
const ANSWER_ORDER=['rio-ceballos','unquillo','mendiolaza','villa-allende','la-calera','saldan','arguello','cerro-de-las-rosas','villa-rivera-indarte'];

const pickupSentence=()=>PICKUP_ADDRESS
  ?`También podés retirarlo en ${PICKUP_ADDRESS}, ${PICKUP_LOCALITY}.`
  :`También podés retirarlo en ${PICKUP_LOCALITY}: coordinamos la dirección por WhatsApp.`;

// Sub-zonas que se entregan dentro de una zona, con su mismo costo. Una sola lista para el checkout
// (desplegable "Localidad": "Villa Allende (incluye Golf, Lomas y Parque)") y para /envios (secciones, tabla, FAQ, llms.txt).
// short: cómo se nombra dentro de la opción del checkout; name: cómo se nombra en /envios.
// No son zonas aparte ni van en areaServed (que queda en las 9 zonas).
export const ZONE_SUB_AREAS={
  'villa-allende':[{short:'Golf',name:'Villa Allende Golf'},{short:'Lomas',name:'Lomas'},{short:'Parque',name:'Villa Allende Parque'}],
  mendiolaza:[{short:'El Talar',name:'El Talar'}],
  'la-calera':[{short:'countries',name:'countries y barrios cerrados'}]
};
const subNames=slug=>(ZONE_SUB_AREAS[slug]||[]).map(a=>a.name);
const subList=slug=>joinEs(subNames(slug));

// Copy por zona: tabla del §5 de spec.md, verbatim. El costo NO va acá: sale de SHIPPING_COST.
// Las sub-zonas (El Talar, countries, Golf/Lomas/Parque) salen de ZONE_SUB_AREAS.
const ZONE_COPY=[
  {slug:'arguello',name:'Argüello',group:'norte',line:'Sí, llegamos a Argüello. Si venís buscando pepas de harina de almendra, en el catálogo están las de frutilla y las de membrillo, por kilo, y viajan con el resto de tu pedido.',question:'¿Dónde compro pepas de almendra en Argüello?',answer:'En Vitalia: pedís las pepas de harina de almendra en la web y te las llevamos a Argüello. El precio por kilo está en cada producto.'},
  {slug:'cerro-de-las-rosas',name:'Cerro de las Rosas',group:'norte',line:'Sí, Vitalia reparte en Cerro de las Rosas. Armás el pedido con lo que necesites del catálogo y lo coordinamos por WhatsApp.',question:'¿Hay dietética con envío en Cerro de las Rosas?',answer:'Sí, Vitalia hace envíos a domicilio en Cerro de las Rosas, todos los días.'},
  {slug:'la-calera',name:'La Calera',group:'sierras',get line(){return `Sí, Vitalia envía a La Calera, también a ${subList('la-calera')}.`;},question:'¿Hay dietética con delivery en La Calera?',answer:'Sí, Vitalia lleva tu pedido de la dietética a La Calera. Lo pedís en la web y coordinamos por WhatsApp el día y el horario de entrega.'},
  {slug:'mendiolaza',name:'Mendiolaza',group:'sierras',get line(){return `Sí, llegamos a Mendiolaza, también a ${subList('mendiolaza')}.`;},get question(){return `¿Qué dietética llega a Mendiolaza y ${subList('mendiolaza')}?`;},get answer(){return `Vitalia hace envíos a Mendiolaza y a ${subList('mendiolaza')}, todos los días. El día y el horario los coordinamos con vos por WhatsApp.`;}},
  {slug:'rio-ceballos',name:'Río Ceballos',group:'sierras',line:'Sí, Vitalia hace envíos a domicilio en Río Ceballos, todos los días.',question:'¿Qué dietética envía a domicilio en Río Ceballos?',answer:'Vitalia envía a domicilio en Río Ceballos: armás el pedido en la web y lo confirmás por WhatsApp, donde coordinamos el día y el horario.'},
  {slug:'saldan',name:'Saldán',group:'sierras',line:'Sí, Vitalia también llega a Saldán.',question:'¿Alguna dietética envía a Saldán?',answer:'Sí, Vitalia hace envíos a Saldán. Entregamos todos los días y el horario lo coordinamos con vos por WhatsApp.'},
  {slug:'unquillo',name:'Unquillo',group:'sierras',line:'Sí, llegamos a Unquillo. Los mixes de frutos secos, como el mix tropical o el mix seco, van por kilo y te los llevamos con el resto del pedido.',question:'¿Quién trae frutos secos a Unquillo?',answer:'Vitalia te lleva frutos secos por kilo a Unquillo: los elegís en la web y coordinamos la entrega por WhatsApp.'},
  {slug:'villa-allende',name:'Villa Allende',group:'sierras',get line(){return `Sí, Vitalia hace envíos a Villa Allende: frutos secos, granolas y galletitas por kilo, en el mismo pedido. También llegamos a ${subList('villa-allende')}.`;},question:'¿Qué dietética hace envíos a Villa Allende?',get answer(){return `Vitalia hace envíos a domicilio en Villa Allende. Hacés el pedido en la web y lo confirmás por WhatsApp. ${pickupSentence()}`;}},
  {slug:'villa-rivera-indarte',name:'Villa Rivera Indarte',group:'norte',line:'Sí, llegamos a Villa Rivera Indarte, en la zona norte de la ciudad.',question:'¿Hay dietética con envío en Villa Rivera Indarte?',answer:'Sí, Vitalia hace envíos a domicilio en Villa Rivera Indarte. El día y el horario los coordinamos con vos por WhatsApp.'}
];
export const ZONE_GROUPS=[{id:'sierras-chicas',key:'sierras',title:'Sierras Chicas'},{id:'zona-norte',key:'norte',title:'Zona norte de Córdoba'}];

// "$3.000" (sin decimales ni espacio, como en el copy).
export const pesos=value=>`$${new Intl.NumberFormat('es-AR',{maximumFractionDigits:0}).format(value)}`;
// "A, B y C".
export const joinEs=items=>items.length<2?items.join(''):`${items.slice(0,-1).join(', ')} y ${items.at(-1)}`;
const FREE=pesos(FREE_SHIPPING_FROM);
const FREE_LINE=`Gratis en compras de más de ${FREE}.`;

const bySlug=Object.fromEntries(ZONE_COPY.map(z=>[z.slug,z]));
const names=slugs=>slugs.map(s=>bySlug[s].name);
// "Villa Allende (incluye Villa Allende Golf, Lomas y Villa Allende Parque)": así se nombra cada zona en la tabla,
// la FAQ de costos y llms.txt.
export const zoneWithSubAreas=slug=>subNames(slug).length?`${bySlug[slug].name} (incluye ${subList(slug)})`:bySlug[slug].name;
const namesWithExtras=slugs=>slugs.map(zoneWithSubAreas);
export const zoneCost=slug=>{const cost=SHIPPING_COST[slug];if(!(cost>0))throw new Error(`/envios: falta el costo de ${slug}`);return cost;};
// Niveles de costo en orden ascendente, con sus zonas en el orden de COST_ORDER.
export function costTiers(){
  const tiers=[...new Set(COST_ORDER.map(zoneCost))].sort((a,b)=>a-b);
  return tiers.map(cost=>{const slugs=COST_ORDER.filter(s=>zoneCost(s)===cost);return {cost,label:pesos(cost),slugs,zones:namesWithExtras(slugs)};});
}

// 5491100000000 → "11 0000-0000"; 5493513947394 → "351 394-7394". Sin número válido, "".
export function localPhone(phone){
  const m=/^549(\d{10})$/.exec(phone||'');
  if(!m)return '';
  const n=m[1];
  return n.startsWith('11')?`11 ${n.slice(2,6)}-${n.slice(6)}`:`${n.slice(0,3)} ${n.slice(3,6)}-${n.slice(6)}`;
}
const validPhone=phone=>/^[1-9]\d{7,14}$/.test(phone||'');
export const waLink=(phone,text)=>validPhone(phone)?`https://wa.me/${phone}?text=${encodeURIComponent(text)}`:'';

const sierras=ANSWER_ORDER.filter(s=>bySlug[s].group==='sierras'),norte=ANSWER_ORDER.filter(s=>bySlug[s].group==='norte');
const ALL_ZONES_SENTENCE=`${joinEs(names(sierras))}, en Sierras Chicas, y a ${joinEs(names(norte))}, en la zona norte de Córdoba`;
const tierRange=()=>joinEs(costTiers().map(t=>t.label)).replace(/ y /,' o ');

export function shipAnswer(){
  return `Vitalia hace envíos a domicilio a ${ALL_ZONES_SENTENCE}. Hacés el pedido en la web, lo confirmás por WhatsApp y coordinamos el día de entrega. El envío cuesta ${tierRange()} según la zona, y es gratis en compras de más de ${FREE}.`;
}

// 13 preguntas del §5 (y de envios.html), todas con respuesta completa. Los montos salen de SHIPPING_COST.
export function faqItems(phone){
  const c=slug=>pesos(zoneCost(slug));
  const same=(a,b)=>zoneCost(a)===zoneCost(b);
  const tiers=costTiers();
  const local=localPhone(phone);
  if(!same('rio-ceballos','unquillo'))throw new Error('/envios: FAQ 3 asume el mismo costo para Río Ceballos y Unquillo');
  if(!same('arguello','cerro-de-las-rosas'))throw new Error('/envios: FAQ 6 asume el mismo costo para Argüello y Cerro de las Rosas');
  return [
    {q:'¿A qué zonas hace envíos Vitalia?',a:`Vitalia hace envíos a ${ALL_ZONES_SENTENCE}.`},
    {q:'¿Hacen envíos a Villa Allende?',a:`Sí, Vitalia envía a Villa Allende. El envío cuesta ${c('villa-allende')} y es gratis en compras de más de ${FREE}. Entregamos todos los días: el día y el horario los coordinamos con vos por WhatsApp.`},
    {q:'¿Llegan a Río Ceballos y Unquillo?',a:`Sí, Vitalia llega a Río Ceballos y a Unquillo. El envío cuesta ${c('rio-ceballos')} y es gratis en compras de más de ${FREE}. Entregamos todos los días.`},
    {q:`¿Envían a Mendiolaza y ${subList('mendiolaza')}?`,a:`Sí, Vitalia envía a Mendiolaza y a ${subList('mendiolaza')}. El envío cuesta ${c('mendiolaza')} y es gratis en compras de más de ${FREE}. Entregamos todos los días.`},
    {q:'¿Llegan a La Calera y Saldán?',a:`Sí. El envío a Saldán cuesta ${c('saldan')} y a La Calera, ${c('la-calera')}. En las dos zonas es gratis en compras de más de ${FREE}.`},
    {q:'¿Hacen envíos en zona norte de Córdoba?',a:`Sí, Vitalia hace envíos a Argüello, Cerro de las Rosas y Villa Rivera Indarte. A Villa Rivera Indarte cuesta ${c('villa-rivera-indarte')} y a Argüello y Cerro de las Rosas, ${c('arguello')}. Es gratis en compras de más de ${FREE}.`},
    {q:'¿Cuánto cuesta el envío?',a:`Depende de la zona: ${joinEs(tiers.map(t=>`${t.label} a ${joinEs(t.zones)}`)).replace(/ y (\$[\d.]+ a )/,', y $1')}. En compras de más de ${FREE}, el envío es gratis.`},
    {q:'¿Hay envío gratis?',a:`Sí. En compras de más de ${FREE}, el envío de Vitalia es gratis a todas las zonas.`},
    // Confirmado por la tienda (28/10): no hay pedido mínimo.
    {q:'¿Hay pedido mínimo?',a:`No, no hay pedido mínimo: podés pedir el monto que quieras. En compras de más de ${FREE}, el envío es gratis.`},
    {q:'¿Cuánto tarda en llegar el pedido?',a:'Vitalia entrega todos los días. El día y el horario los coordinamos con vos por WhatsApp. Lo arreglamos cuando confirmamos tu pedido.'},
    {q:'¿Cómo se paga?',a:`Con ${PAYMENT_METHODS.map(m=>m.toLowerCase()).join(' o en ')}. La web de Vitalia no cobra: el pago se coordina por WhatsApp cuando confirmamos tu pedido.`},
    {q:'¿Puedo retirar el pedido?',a:PICKUP_ADDRESS?`Sí, podés retirar tu pedido en ${PICKUP_ADDRESS}, ${PICKUP_LOCALITY}. Coordinamos el retiro por WhatsApp.`:`Sí, podés retirar tu pedido en ${PICKUP_LOCALITY}. Coordinamos la dirección por WhatsApp.`},
    {q:'¿Cómo hago el pedido?',a:`En Vitalia armás el pedido en la web, lo revisás en el carrito y lo mandás por WhatsApp${local?` al ${local}`:''}. Ahí coordinamos la entrega.`}
  ];
}

export function pickupData(){
  if(PICKUP_ADDRESS)return {
    line:`${PICKUP_ADDRESS}, ${PICKUP_LOCALITY}, Córdoba`,
    note:'Si preferís pasar a buscarlo, armá el pedido en la web y coordinamos el retiro por WhatsApp.',
    mapsUrl:`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${PICKUP_ADDRESS} ${PICKUP_LOCALITY} Córdoba`).replace(/%20/g,'+')}`
  };
  return {line:`Retiro en ${PICKUP_LOCALITY}, coordinamos la dirección por WhatsApp.`,note:'Si preferís pasar a buscarlo, armá el pedido en la web y te pasamos la dirección.',mapsUrl:''};
}

// Nodo de la tienda (también lo usa la home): localidad sin calle, Instagram y medios de pago. Sin horarios.
export function storeAddress(){
  const address={'@type':'PostalAddress',addressLocality:PICKUP_LOCALITY,addressRegion:'Córdoba',addressCountry:'AR'};
  if(PICKUP_ADDRESS)address.streetAddress=PICKUP_ADDRESS;
  return address;
}
export const STORE_EXTRAS={sameAs:[INSTAGRAM_URL],paymentAccepted:PAYMENT_METHODS.join(', ')};

export function enviosPageData(phone){
  const zones=ZONE_COPY.map(z=>{const cost=zoneCost(z.slug);return {...z,answer:z.answer,cost,costLabel:pesos(cost),costLine:`Envío a ${z.name}: ${pesos(cost)}.`,freeLine:FREE_LINE,whatsappUrl:waLink(phone,`Hola, quiero hacer un pedido con envío a ${z.name}.`)};});
  const tiers=costTiers();
  return {
    title:ENVIOS_TITLE,answer:shipAnswer(),
    chips:[...zones].sort((a,b)=>a.name.localeCompare(b.name,'es')).map(z=>({slug:z.slug,name:z.name})),
    facts:[['Costo de envío',`${tierRange()} · gratis desde ${FREE}`],['Días de entrega','Todos los días'],['Medios de pago',joinEs(PAYMENT_METHODS.map((m,i)=>i?m.toLowerCase():m)).replace(/ y /,' o ')]],
    groups:ZONE_GROUPS.map(g=>({...g,zones:zones.filter(z=>z.group===g.key).sort((a,b)=>a.name.localeCompare(b.name,'es'))})),
    otherZoneUrl:waLink(phone,'¡Hola, Vitalia! Quiero consultar si hacen envíos a mi zona.'),
    orderUrl:waLink(phone,'Hola, quiero hacer un pedido con envío a ___'),
    table:[...tiers.map(t=>({label:joinEs(t.zones),value:t.label,free:false})),{label:`Compras de más de ${FREE}, todas las zonas`,value:'Gratis',free:true}],
    terms:[['Días de entrega','Todos los días'],['Día y horario','Los coordinamos con vos por WhatsApp'],['Medios de pago',joinEs(PAYMENT_METHODS.map((m,i)=>i?m.toLowerCase():m)).replace(/ y /,' o ')],['Pedido mínimo','Sin pedido mínimo']],
    pickup:pickupData(),
    faq:faqItems(phone)
  };
}

// El build falla si "[A " aparece en cualquier parte del HTML renderizado (texto, atributos, title, meta, JSON-LD).
export function assertNoMarkerInHtml(html,label='/envios'){
  const i=String(html).indexOf('[A ');
  if(i>=0)throw new Error(`${label}: el HTML tiene un marcador "[A " (…${String(html).slice(Math.max(0,i-40),i+40)}…). Completá el dato o sacalo antes de publicar.`);
  return html;
}

// ── Checkout: desplegable "Localidad" y costo de envío ─────────────────────────────────────────
// Mismas zonas, montos y sub-zonas que /envios. El navegador solo muestra una vista previa:
// el servidor (lib/checkout.js) recalcula el costo desde el slug y nunca toma un monto del cliente.
export const OTHER_ZONE='otra';
export const OTHER_ZONE_LABEL='Otra localidad';
export const OTHER_LOCALITY_MAX=60;
export const isShippingZone=slug=>typeof slug==='string'&&Object.hasOwn(SHIPPING_COST,slug);
export const zoneName=slug=>isShippingZone(slug)?bySlug[slug].name:'';
// "Villa Allende (incluye Golf, Lomas y Parque)".
export const zoneOptionLabel=slug=>{const subs=ZONE_SUB_AREAS[slug]||[];return subs.length?`${bySlug[slug].name} (incluye ${joinEs(subs.map(a=>a.short))})`:bySlug[slug].name;};
// Grupos del desplegable por costo ascendente ("Envío $3.000", "Envío $5.000"), en el orden de la tabla.
export function checkoutZoneGroups(){
  return costTiers().map(t=>({cost:t.cost,label:`Envío ${t.label}`,options:t.slugs.map(slug=>({value:slug,label:zoneOptionLabel(slug)}))}));
}
export const SHIPPING_PENDING_LABEL='Elegí tu localidad';
export const SHIPPING_OTHER_LABEL='A coordinar por WhatsApp';
// zone: slug de SHIPPING_COST, OTHER_ZONE o vacío. freeShipping: la misma regla del carrito (computeTotals).
// kind: pending (sin elegir) | free | zone | other. cents: lo que se suma al total (0 salvo kind zone).
// "Otra localidad" queda fuera de las zonas con costo fijo: se coordina por WhatsApp aunque supere el envío gratis.
export function shippingQuote(zone,freeShipping){
  if(zone===undefined||zone===null||zone==='')return {kind:'pending',cents:0,label:SHIPPING_PENDING_LABEL};
  if(zone===OTHER_ZONE)return {kind:'other',cents:0,label:SHIPPING_OTHER_LABEL};
  if(!isShippingZone(zone))return null;
  if(freeShipping)return {kind:'free',cents:0,label:'Gratis'};
  const cost=zoneCost(zone);
  return {kind:'zone',cents:cost*100,label:pesos(cost)};
}
