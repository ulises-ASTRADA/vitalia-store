import Boxes from '../../components/boxes';
import {getInitialCatalog} from '../../lib/render-catalog';
import {storeSettings} from '../../lib/catalog';
import {whatsappUrl} from '../../lib/seo';
export const revalidate=60;
export const runtime='nodejs';
export const metadata={title:'Boxes · Vitalia'};
export default async function BoxesPage(){return <Boxes initialCatalog={await getInitialCatalog()} storeWhatsappUrl={whatsappUrl(storeSettings().phone)}/>;}
