import Store from '../components/store';
import { getInitialCatalog } from '../lib/render-catalog';
export const revalidate = 60;
export const runtime = 'nodejs';
export default async function Page({searchParams}) {
  const [initialCatalog,params] = await Promise.all([getInitialCatalog(),searchParams]);
  const initialQuery=typeof params?.q==='string'?params.q:'';
  return <Store initialCatalog={initialCatalog} initialQuery={initialQuery}/>;
}
