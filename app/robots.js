export default function robots() {
  return {rules:{userAgent:'*',allow:'/',disallow:['/api/','/checkout']},sitemap:'https://www.vitalia.energy/sitemap.xml'};
}
