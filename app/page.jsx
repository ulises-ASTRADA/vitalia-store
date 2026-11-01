import {headers} from 'next/headers';
import Store from '../components/store';
import { getInitialCatalog } from '../lib/render-catalog';
import { storeSettings } from '../lib/catalog';
import { shareMetadata } from '../lib/og';
import { HOME_TITLE, HOME_DESCRIPTION, homeJsonLd, serializeJsonLd, whatsappUrl } from '../lib/seo';
export const revalidate = 60;
export const runtime = 'nodejs';
const homeMetadata = {
  title: {absolute:HOME_TITLE},
  description: HOME_DESCRIPTION,
  alternates: {canonical:'/'},
  ...shareMetadata({path:'/',title:HOME_TITLE,description:HOME_DESCRIPTION})
};
// Los resultados de búsqueda (/?q=) no se indexan pero sus links se siguen; el canonical queda en la home sin ?q.
export async function generateMetadata({searchParams}) {
  const params = await searchParams;
  return params?.q!==undefined ? {...homeMetadata,robots:{index:false,follow:true}} : homeMetadata;
}
export default async function Page({searchParams}) {
  const [initialCatalog,params,requestHeaders] = await Promise.all([getInitialCatalog(),searchParams,headers()]);
  const initialQuery=typeof params?.q==='string'?params.q:'';
  const nonce=requestHeaders.get('x-nonce')||undefined;
  const {phone}=storeSettings();
  return <>
    <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{__html:serializeJsonLd(homeJsonLd(phone))}}/>
    <Store initialCatalog={initialCatalog} initialQuery={initialQuery} whatsappUrl={whatsappUrl(phone)}/>
  </>;
}
