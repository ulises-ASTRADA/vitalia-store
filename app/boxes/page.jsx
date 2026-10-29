import Boxes from '../../components/boxes';
import {getInitialCatalog} from '../../lib/render-catalog';
import {storeSettings} from '../../lib/catalog';
import {whatsappUrl} from '../../lib/seo';
import {shareMetadata} from '../../lib/og';
// Mismo texto que la descripción general del sitio (layout).
const BOXES_SHARE_DESCRIPTION='Explorá el catálogo de Vitalia. Armá tu carrito y coordiná tu pedido por WhatsApp.';
export const revalidate=60;
export const runtime='nodejs';
export const metadata={title:'Boxes · Vitalia',...shareMetadata({path:'/boxes',title:'Boxes · Vitalia',description:BOXES_SHARE_DESCRIPTION})};
export default async function BoxesPage(){return <Boxes initialCatalog={await getInitialCatalog()} storeWhatsappUrl={whatsappUrl(storeSettings().phone)}/>;}
