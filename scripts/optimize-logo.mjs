import sharp from 'sharp';
import {readFile,open,rename} from 'node:fs/promises';
// Derivados para web. El logo original se conserva para etiquetas y documentos.
for (const [name,options] of [
  ['logo-web.webp',{width:468,withoutEnlargement:true}],
  ['favicon.webp',{width:64,height:64,fit:'contain',background:'#ffffff'}]
]) {
  const bytes=await sharp('public/images/logo.png').resize(options).webp({quality:90}).toBuffer();
  const path=`public/images/${name}`;
  try {if((await readFile(path)).equals(bytes))continue;}catch{}
  const handle=await open(path+'.pending','w');
  try{await handle.writeFile(bytes);await handle.sync();}finally{await handle.close();}
  await rename(path+'.pending',path);
  console.log(`${name}: ${bytes.length} bytes`);
}
