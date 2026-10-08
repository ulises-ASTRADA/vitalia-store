import Checkout from '../../components/checkout';
import {getInitialCatalog} from '../../lib/render-catalog';
export const revalidate=60;
export const runtime='nodejs';
export const metadata={title:'Tu pedido · Vitalia'};
export default async function CheckoutPage(){return <Checkout initialCatalog={await getInitialCatalog()}/>;}
