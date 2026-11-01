import {headers} from 'next/headers';
import EnviosPage from '../../components/envios-page';
import {getInitialCatalog} from '../../lib/render-catalog';
import {storeSettings} from '../../lib/catalog';
import {serializeJsonLd,enviosJsonLd,whatsappUrl} from '../../lib/seo';
import {shareMetadata} from '../../lib/og';
import {ENVIOS_PATH,ENVIOS_META_TITLE,ENVIOS_DESCRIPTION,enviosPageData,assertNoMarkerInHtml} from '../../lib/envios';
export const revalidate=60;
export const runtime='nodejs';

export const metadata={
  title:{absolute:ENVIOS_META_TITLE},
  description:ENVIOS_DESCRIPTION,
  alternates:{canonical:ENVIOS_PATH},
  ...shareMetadata({path:ENVIOS_PATH,title:ENVIOS_META_TITLE,description:ENVIOS_DESCRIPTION})
};

// Todo lo que va al HTML (copy, metadatos y JSON-LD). Si trae "[A ", tira error.
function model(phone){
  const page=enviosPageData(phone),jsonLd=serializeJsonLd(enviosJsonLd(phone));
  assertNoMarkerInHtml(JSON.stringify({metadata,page})+jsonLd);
  return {page,jsonLd};
}
// Corre al cargar el módulo, también en el build: un marcador hace fallar `next build`.
model(storeSettings().phone);

export default async function Page() {
  const [catalog,requestHeaders]=await Promise.all([getInitialCatalog(),headers()]);
  const nonce=requestHeaders.get('x-nonce')||undefined;
  const {page,jsonLd}=model(storeSettings().phone);
  return <>
    <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{__html:jsonLd}}/>
    <EnviosPage catalog={catalog} page={page} storeWhatsappUrl={whatsappUrl(storeSettings().phone)}/>
  </>;
}
