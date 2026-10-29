// Datos SEO de la home. Solo hechos confirmados: sin dirección, horarios, precios ni redes.
export const SITE_URL='https://www.vitalia.energy';

const cordobaProvincia={'@type':'AdministrativeArea','name':'Provincia de Córdoba, Argentina'};
const cordobaCiudad={'@type':'City','name':'Córdoba','containedInPlace':cordobaProvincia};
// Sierras Chicas y alrededores como City; barrios de la ciudad de Córdoba como Place.
export const DELIVERY_ZONES=[
  ...['Río Ceballos','Unquillo','Mendiolaza','Villa Allende','La Calera','Saldán'].map(name=>({'@type':'City',name,containedInPlace:cordobaProvincia})),
  ...['Argüello','Cerro de las Rosas','Villa Rivera Indarte'].map(name=>({'@type':'Place',name,containedInPlace:cordobaCiudad}))
];

export const HOME_TITLE='Dietética con envío a Villa Allende, Unquillo y Sierras Chicas | Vitalia';
export const HOME_DESCRIPTION='Pepas de almendra, chalitas, cookies con stevia y frutos secos por kilo. Pedí por WhatsApp con envío a Villa Allende, Unquillo, Río Ceballos, Mendiolaza, La Calera, Saldán y zona norte de Córdoba.';
const STORE_DESCRIPTION='Vitalia es una dietética online de Córdoba. Vende pepas de harina de almendra, cookies endulzadas con miel y stevia, chalitas y mixes de frutos secos, la mayoría por kilo. El pedido se arma en la web y se confirma por WhatsApp.';

// El número sale de WHATSAPP_NUMBER (solo servidor). Si no es válido, no se publica nada.
export function whatsappUrl(phone){return /^[1-9]\d{7,14}$/.test(phone||'')?`https://wa.me/${phone}`:'';}

export function homeJsonLd(phone){
  const wa=whatsappUrl(phone);
  const store={
    '@type':'HealthFoodStore','@id':`${SITE_URL}/#tienda`,name:'Vitalia',url:`${SITE_URL}/`,
    logo:`${SITE_URL}/images/logo.png`,image:`${SITE_URL}/images/logo.png`,description:STORE_DESCRIPTION,
    currenciesAccepted:'ARS',areaServed:DELIVERY_ZONES
  };
  if(wa){store.telephone=`+${phone}`;store.contactPoint={'@type':'ContactPoint',contactType:'pedidos',telephone:`+${phone}`,url:wa,availableLanguage:'es'};}
  return {'@context':'https://schema.org','@graph':[store,{'@type':'WebSite','@id':`${SITE_URL}/#web`,url:`${SITE_URL}/`,name:'Vitalia',inLanguage:'es-AR',publisher:{'@id':`${SITE_URL}/#tienda`}}]};
}
// Escapa "<" para que el JSON no pueda cerrar el <script> (condición de Sentinel).
export const serializeJsonLd=data=>JSON.stringify(data).replace(/</g,'\\u003c');
