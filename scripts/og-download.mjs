// Lectura con tope de una respuesta HTTP: corta por content-length antes de bajar el cuerpo
// y, si el header falta o miente, aborta el stream apenas se pasa del tope.
export const MAX_DOWNLOAD=15*1024*1024;
export async function readCapped(r,max=MAX_DOWNLOAD,controller){
  const len=r.headers.get('content-length');
  if(len!==null&&Number(len)>max){controller?.abort();await r.body?.cancel().catch(()=>{});throw new Error('demasiado grande');}
  const chunks=[];let total=0;
  if(!r.body)return Buffer.alloc(0);
  const reader=r.body.getReader();
  for(;;){const {done,value}=await reader.read();if(done)break;
    total+=value.byteLength;
    if(total>max){controller?.abort();await reader.cancel().catch(()=>{});throw new Error('demasiado grande');}
    chunks.push(Buffer.from(value));}
  return Buffer.concat(chunks,total);
}
