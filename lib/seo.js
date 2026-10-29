// Datos SEO de la home y de /envios. Solo hechos confirmados (28/10): localidad sin calle, Instagram,
// medios de pago y zonas. Sin horarios ni dirección (PICKUP_ADDRESS en lib/envios.js).
import {STORE_EXTRAS,storeAddress,ENVIOS_PATH,ENVIOS_TITLE,ENVIOS_DESCRIPTION,faqItems} from './envios.js';
export const SITE_URL='https://www.vitalia.energy';

const cordobaProvincia={'@type':'AdministrativeArea','name':'Provincia de Córdoba, Argentina'};
const cordobaCiudad={'@type':'City','name':'Córdoba','containedInPlace':cordobaProvincia};
// Sierras Chicas y alrededores como City; barrios de la ciudad de Córdoba como Place.
export const DELIVERY_ZONES=[
  ...['Río Ceballos','Unquillo','Mendiolaza','Villa Allende','La Calera','Saldán'].map(name=>({'@type':'City',name,containedInPlace:cordobaProvincia})),
  ...['Argüello','Cerro de las Rosas','Villa Rivera Indarte'].map(name=>({'@type':'Place',name,containedInPlace:cordobaCiudad}))
];

export const HOME_TITLE='Dietética con envío a Villa Allende, Unquillo y Sierras Chicas | Vitalia';
export const HOME_DESCRIPTION='Pepas de almendra, chalitas, cookies con stevia y frutos secos por kilo. Pedí por WhatsApp con envío a Sierras Chicas y zona norte de Córdoba.';
const STORE_DESCRIPTION='Vitalia es una dietética online de Córdoba. Vende pepas de harina de almendra, cookies endulzadas con miel y stevia, chalitas y mixes de frutos secos, la mayoría por kilo. El pedido se arma en la web y se confirma por WhatsApp.';

// El número sale de WHATSAPP_NUMBER (solo servidor). Si no es válido, no se publica nada.
export function whatsappUrl(phone){return /^[1-9]\d{7,14}$/.test(phone||'')?`https://wa.me/${phone}`:'';}

export function storeJsonLd(phone){
  const wa=whatsappUrl(phone);
  const store={
    '@type':'HealthFoodStore','@id':`${SITE_URL}/#tienda`,name:'Vitalia',url:`${SITE_URL}/`,
    logo:`${SITE_URL}/images/logo.png`,image:`${SITE_URL}/images/logo.png`,description:STORE_DESCRIPTION,
    address:storeAddress(),sameAs:STORE_EXTRAS.sameAs,
    currenciesAccepted:'ARS',paymentAccepted:STORE_EXTRAS.paymentAccepted,areaServed:DELIVERY_ZONES
  };
  if(wa){store.telephone=`+${phone}`;store.contactPoint={'@type':'ContactPoint',contactType:'pedidos',telephone:`+${phone}`,url:wa,availableLanguage:'es'};}
  return store;
}

export function homeJsonLd(phone){
  return {'@context':'https://schema.org','@graph':[storeJsonLd(phone),{'@type':'WebSite','@id':`${SITE_URL}/#web`,url:`${SITE_URL}/`,name:'Vitalia',inLanguage:'es-AR',publisher:{'@id':`${SITE_URL}/#tienda`}}]};
}
// /envios: WebPage + BreadcrumbList + FAQPage (las 12 preguntas visibles). La tienda vive en la home
// y acá se referencia por @id (#tienda), como pide el spec §5.
export function enviosJsonLd(phone){
  const url=`${SITE_URL}${ENVIOS_PATH}`;
  return {'@context':'https://schema.org','@graph':[
    {'@type':'WebPage','@id':`${url}#pagina`,url,name:ENVIOS_TITLE,description:ENVIOS_DESCRIPTION,inLanguage:'es-AR',isPartOf:{'@id':`${SITE_URL}/#web`},about:{'@id':`${SITE_URL}/#tienda`},breadcrumb:{'@id':`${url}#ruta`}},
    {'@type':'BreadcrumbList','@id':`${url}#ruta`,itemListElement:[{'@type':'ListItem',position:1,name:'Inicio',item:`${SITE_URL}/`},{'@type':'ListItem',position:2,name:'Envíos',item:url}]},
    {'@type':'FAQPage','@id':`${url}#preguntas`,mainEntity:faqItems(phone).map(({q,a})=>({'@type':'Question',name:q,acceptedAnswer:{'@type':'Answer',text:a}}))}
  ]};
}
// Escapa "<" para que el JSON no pueda cerrar el <script> (condición de Sentinel).
export const serializeJsonLd=data=>JSON.stringify(data).replace(/</g,'\\u003c');
