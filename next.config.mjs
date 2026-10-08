export default {
  experimental: { optimizePackageImports: ['@chakra-ui/react'] },
  images: {formats:['image/webp'],minimumCacheTTL:60},
  outputFileTracingIncludes: { '/': ['./data/catalog.json'], '/checkout': ['./data/catalog.json'], '/api/catalog': ['./data/catalog.json'], '/api/checkout': ['./data/catalog.json'] },
  async headers() {
    return [{source:'/(.*)',headers:[
      {key:'X-Content-Type-Options',value:'nosniff'},
      {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
      {key:'X-Frame-Options',value:'DENY'},
      {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'},
      {key:'Content-Security-Policy',value:"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; connect-src 'self'; font-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"}
    ]}];
  }
};
