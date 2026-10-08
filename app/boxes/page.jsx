import Boxes from '../../components/boxes';
import {getInitialCatalog} from '../../lib/render-catalog';
export const revalidate=60;
export const runtime='nodejs';
export const metadata={title:'Boxes · Vitalia'};
export default async function BoxesPage(){return <Boxes initialCatalog={await getInitialCatalog()}/>;}
