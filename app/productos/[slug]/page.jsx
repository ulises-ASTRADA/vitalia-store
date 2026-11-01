import {shareMetadata,productShareImage} from '../../../lib/og';
import {headers} from 'next/headers';
import {notFound,permanentRedirect} from 'next/navigation';
import ProductPage from '../../../components/product-page';
import {getInitialCatalog} from '../../../lib/render-catalog';
import {getCatalog,storeSettings} from '../../../lib/catalog';
import {serializeJsonLd,whatsappUrl} from '../../../lib/seo';
import {categoryPath} from '../../../lib/product-links';
import {pageProducts,productPageData,relatedProducts,resolveProduct,assertNoPlaceholders} from '../../../lib/product-pages';
export const revalidate=60;
export const runtime='nodejs';
// Solo existen las páginas generadas en el build: un slug desconocido es 404.
export const dynamicParams=false;

// Corre en el build: si algún dato que se va a renderizar trae un marcador, el build falla.
export async function generateStaticParams() {
  // Lectura directa (sin la caché de datos) para validar el catálogo real de este build.
  const {products}=await getCatalog({fresh:true});
  const {phone}=storeSettings();
  const {currency}=storeSettings();
  return pageProducts(products).map(product=>{
    const page=assertNoPlaceholders(pageModel(products,product,{currency,phone}),`/productos (${product.id})`);
    return {slug:page.page.slug};
  });
}

function pageModel(products,product,{currency,phone}) {
  const page=productPageData(product,{currency,phone,products});
  const related=relatedProducts(products,product);
  const count=products.filter(p=>p.categoria===product.categoria).length;
  return {product,page,related,category:{href:categoryPath(product.categoria),count}};
}

async function load(params) {
  const [{slug},catalog]=await Promise.all([params,getInitialCatalog()]);
  const found=resolveProduct(catalog.products,slug);
  if(!found)notFound();
  // Si el nombre cambió en el Sheet, el slug viejo (mismo código al final) redirige con 308 al nuevo.
  if(found.canonicalSlug!==slug)permanentRedirect(`/productos/${found.canonicalSlug}`);
  const {phone}=storeSettings();
  const model=pageModel(catalog.products,found.product,{currency:catalog.settings.currency,phone});
  // Un marcador que aparezca en el Sheet después del build no se publica: 404 hasta corregirlo.
  try{assertNoPlaceholders(model,'/productos');}catch{notFound();}
  return {catalog,model};
}

export async function generateMetadata({params}) {
  const {model:{product,page}}=await load(params);
  return {
    title:{absolute:page.title},
    description:page.metaDescription,
    alternates:{canonical:`/productos/${page.slug}`},
    ...shareMetadata({path:`/productos/${page.slug}`,title:page.title,description:page.metaDescription,image:productShareImage(product)})
  };
}

export default async function Page({params}) {
  const [{catalog,model},requestHeaders]=await Promise.all([load(params),headers()]);
  const nonce=requestHeaders.get('x-nonce')||undefined;
  const {page,...rest}=model;
  const {jsonLd,...client}=page;
  return <>
    <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{__html:serializeJsonLd(jsonLd)}}/>
    <ProductPage catalog={catalog} page={client} {...rest} storeWhatsappUrl={whatsappUrl(storeSettings().phone)}/>
  </>;
}
