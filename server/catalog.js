import {getCatalog,publicSettings} from '../lib/catalog.js';
export async function GET(request) {
  try {
    const catalog=await getCatalog({fresh:request ? new URL(request.url).searchParams.get('fresh')==='1' : false});
    return Response.json({...catalog,settings:publicSettings()}, {headers:{'Cache-Control':'no-store'}});
  } catch(error) {
    return Response.json({error:'No pudimos cargar los productos. Intentá nuevamente en unos minutos.'},{status:503,headers:{'Cache-Control':'no-store'}});
  }
}
