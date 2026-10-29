import {unsubscribeGET,unsubscribePOST} from '../../../../server/growth.js';
export const runtime='nodejs';
export const GET=request=>unsubscribeGET(request);
export const POST=request=>unsubscribePOST(request);
