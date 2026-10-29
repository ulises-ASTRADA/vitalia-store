# Revisión de seguridad — 2026-10-12

## Cambios de la aplicación

- El catálogo público ignora `fresh=1`. Render, API y checkout comparten caché persistente Next con vigencia de 60 segundos. Los precios del pedido se validan contra esta copia; la disponibilidad final se confirma por WhatsApp.
- Defensa adicional por instancia: 120 consultas de catálogo y 30 preparaciones de checkout por minuto y dirección IP de Vercel. En local o sin IP confiable se usa un bucket común. No equivale a un rate limit distribuido.
- Checkout exige un Origin exacto de `https://www.vitalia.energy` o `https://vitalia.energy`, sin confiar en Host. Previews aceptan su `VERCEL_URL`; local acepta loopback. Producción no acepta pedidos de prueba.
- CSP con nonce criptográfico por respuesta para scripts; el script inicial de next-themes recibe el mismo nonce. Las páginas HTML ahora son dinámicas y no se cachean en CDN. La caché de datos se conserva. `style-src 'unsafe-inline'` permanece por Chakra/Emotion y los estilos dinámicos de la interfaz; `script-src` no lo permite.
- HSTS de dos años con includeSubDomains y preload. Esto no inscribe el dominio automáticamente en la lista de preload.
- CI usa un teléfono ficticio. `robots.txt`, `sitemap.xml` y `/.well-known/security.txt` agregados; contacto público `hola@vitalia.energy`. Se conserva el noindex existente del HTML: publicar un sitemap no habilita por sí solo la indexación.

## Configuración externa

- Google Workspace: SPF, MX y DKIM ya existían al revisar; no se reemplazaron.
- DMARC añadido con `p=none` y reportes a `hola@vitalia.energy`. Revisar alineación SPF/DKIM y reportes antes de pasar a quarantine/reject; none monitorea, todavía no bloquea suplantación.
- Dependabot alerts y automated security fixes habilitados y verificados.
- `ALLOW_TEST_CHECKOUT=false` en Production para futuros despliegues; Preview conserva las pruebas. Las variables de Vercel no cambian el deployment actual hasta redesplegar.
- Supabase: revocados permisos EXECUTE de `public`, `anon` y `authenticated` sobre `public.rls_auto_enable()`. Verificado anon_execute=false y authenticated_execute=false. El event trigger `ensure_rls` sigue habilitado (`O`). SQL reproducible en `supabase-rls-function.sql`.

## Firewall pendiente de publicación

Regla `Vitalia API rate observation`: rutas exactas `/api/catalog` o `/api/checkout`, 300 solicitudes por IP cada 60 segundos, acción al exceder `log`. Es un borrador; no está activa en producción y todavía no bloquea.

Publicar observación desde el proyecto, revisar tráfico legítimo y luego endurecer el límite en una etapa separada. La skill Vercel Firewall requiere que el usuario publique el borrador.

```sh
npx vercel@63.1.2 firewall publish --project vitalia-store --yes
```

## Validación

- `npm test`: 26/26; `npm run test:ui`: 10/10.
- Build y verificación HTTP con CSP/nonce/HSTS/origen: correctos.
- Prueba de navegador específica: 4/4 escenarios (1440 y 390 px, claro y oscuro), hidratación, persistencia del tema y checkout real contra la API, interceptando la salida a WhatsApp.
- Suite E2E local existente: 32/40. Ocho fallas corresponden a expectativas antiguas del toggle y del checkout anterior con vista previa del mensaje; se documentan sin modificar esos tests ajenos a este cambio.
- No se envían mensajes por WhatsApp ni se modifica la planilla.
