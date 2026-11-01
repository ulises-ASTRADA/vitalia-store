import Boxes from '../../components/boxes';
import {getInitialCatalog} from '../../lib/render-catalog';
import {storeSettings} from '../../lib/catalog';
import {whatsappUrl} from '../../lib/seo';
import {shareMetadata} from '../../lib/og';
import {BOXES_TITLE,BOXES_DESCRIPTION} from '../../lib/boxes-seo';
export const revalidate=60;
export const runtime='nodejs';
export const metadata={title:{absolute:BOXES_TITLE},description:BOXES_DESCRIPTION,...shareMetadata({path:'/boxes',title:BOXES_TITLE,description:BOXES_DESCRIPTION})};
export default async function BoxesPage(){return <Boxes initialCatalog={await getInitialCatalog()} storeWhatsappUrl={whatsappUrl(storeSettings().phone)}/>;}
