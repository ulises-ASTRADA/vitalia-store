export default function sitemap() {
  return ['','/boxes'].map(path=>({url:`https://www.vitalia.energy${path}`}));
}
