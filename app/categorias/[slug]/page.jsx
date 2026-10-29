import {headers} from 'next/headers';
import {notFound} from 'next/navigation';
import CategoryPage from '../../../components/category-page';
import {getInitialCatalog} from '../../../lib/render-catalog';
import {getCatalog} from '../../../lib/catalog';
import {serializeJsonLd} from '../../../lib/seo';
import {categoryPath} from '../../../lib/product-links';
import {categoryList,categoryPageData,assertNoPlaceholders} from '../../../lib/product-pages';
export const revalidate=60;
export const runtime='nodejs';
// Solo las categorías con productos activos al momento del build; el resto es 404.
export const dynamicParams=false;

// Corre en el build: si algún dato que se va a renderizar trae un marcador, el build falla.
export async function generateStaticParams() {
  // Lectura directa (sin la caché de datos) para validar el catálogo real de este build.
  const {products}=await getCatalog({fresh:true});
  return categoryList(products).map(({slug})=>{
    const data=categoryPageData(products,slug);
    assertNoPlaceholders({name:data.name,intro:data.intro,title:data.title,jsonLd:data.jsonLd,items:data.items},`/categorias/${slug}`);
    return {slug};
  });
}

async function load(params) {
  const [{slug},catalog]=await Promise.all([params,getInitialCatalog()]);
  const data=categoryPageData(catalog.products,slug);
  if(!data||!data.count)notFound();
  try{assertNoPlaceholders({name:data.name,intro:data.intro,items:data.items},`/categorias/${slug}`);}catch{notFound();}
  return {catalog,data};
}

export async function generateMetadata({params}) {
  const {data}=await load(params);
  return {
    title:{absolute:data.title},
    ...(data.intro?{description:data.intro}:{}),
    alternates:{canonical:categoryPath(data.name)},
    openGraph:{type:'website',url:categoryPath(data.name),siteName:'Vitalia',locale:'es_AR',title:data.title,...(data.intro?{description:data.intro}:{}),images:[{url:'/images/logo.png',width:1536,height:1024,alt:'Vitalia Dietética'}]}
  };
}

export default async function Page({params}) {
  const [{catalog,data},requestHeaders]=await Promise.all([load(params),headers()]);
  const nonce=requestHeaders.get('x-nonce')||undefined;
  const categories=categoryList(catalog.products).map(c=>({...c,href:categoryPath(c.name)}));
  return <>
    <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{__html:serializeJsonLd(data.jsonLd)}}/>
    <CategoryPage catalog={catalog} category={{name:data.name,slug:data.slug,intro:data.intro}} categories={categories}/>
  </>;
}
