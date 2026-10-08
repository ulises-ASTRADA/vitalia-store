import Store from '../components/store';
import { getInitialCatalog } from '../lib/render-catalog';
export const revalidate = 60;
export const runtime = 'nodejs';
export default async function Page() {
  const initialCatalog = await getInitialCatalog();
  return <Store initialCatalog={initialCatalog}/>;
}
