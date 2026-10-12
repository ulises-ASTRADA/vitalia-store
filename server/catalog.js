import {publicSettings} from '../lib/catalog.js';
import {getCachedCatalog} from '../lib/render-catalog.js';
import {limitRequest} from '../lib/request-security.js';
export async function GET(request) {
  try {
    const limited=limitRequest(request,'catalog',120);if(limited)return limited;
    const catalog=await getCachedCatalog();
    return Response.json({...catalog,settings:publicSettings()}, {headers:{'Cache-Control':'no-store'}});
  } catch(error) {
    return Response.json({error:'No pudimos cargar los productos. Intentá nuevamente en unos minutos.'},{status:503,headers:{'Cache-Control':'no-store'}});
  }
}
