# Boxes Vitalia — 8 de octubre de 2026

Implementado directamente en `/Users/ulises/Desktop/projects/ecom-mily/vitalia-store`.

- Sección de boxes integrada antes del catálogo: BOX Vitalia, Vitalia Work, Box Enérgico y Box del mes pendiente.
- Asistente con destinatario, preferencia dulce/salado/variado, objetivo, monto máximo opcional e ingredientes a evitar. Las preguntas se adaptan si es para regalo.
- Los tres rangos de presupuesto aún no se definieron: se permite un monto libre en pesos, sin valores inventados.
- Propuestas con una presentación real de cada SKU, productos distintos, precio actual y total dentro del presupuesto. La selección prioriza opciones económicas y distintas familias de productos. Se pueden quitar opciones antes de aceptar.
- Exclusiones por el texto público disponible; no se afirma que los productos sean libres de alérgenos. Se indica revisar ingredientes y trazas. Se muestran las descripciones disponibles de cada producto.
- El carrito cambia únicamente al aceptar. Se verifican los límites antes de guardar para evitar adiciones parciales; las cantidades previas se conservan. Los boxes no incorporan packaging de regalo ni un descuento adicional.
- No se modificaron catálogo, precios, stock, inactivos, `.env.local` o `.vercel/project.json`. El checkout sigue en modo de prueba y no se abrieron enlaces de WhatsApp.

## Archivos

`components/box-builder.jsx`, `lib/boxes.js`, integración en `components/store.jsx`, incorporación atómica al carrito en `components/use-cart.js`, estilos en `app/globals.css`, documentación en `README.md`, pruebas en `tests/boxes.test.mjs` y `tests/ui.test.jsx`.

## Verificaciones efectivas

- `npm test`: 22 aprobadas, incluidas selección, preferencias, presupuesto, exclusión de inactivos/agotados, precios intactos y distinción entre frutos secos y semillas.
- `npm run test:ui`: 10 aprobadas. Incluyen preguntas para regalo, presupuesto, quitar productos, aceptación explícita, persistencia al checkout y rechazo atómico cuando un producto alcanza 99 presentaciones. Son pruebas con DOM simulado, no visuales.
- `PREVIEW_MODE=false ALLOW_TEST_CHECKOUT=true WHATSAPP_NUMBER=5493512136078 npm run build`: aprobado con webpack y Next.js 16.3.8.
- El HTML compilado contiene la sección de boxes y conserva las 24 tarjetas iniciales del catálogo. Las rutas `/` y `/checkout` conservan revalidación de 60 segundos.
- Comprobación por SHA-256: `.env.local` y `.vercel/project.json` permanecen idénticos a los valores anteriores.

## Pendiente por restricciones del entorno

El intento de iniciar el servidor en 127.0.0.1:3100 falla con `listen EPERM`. No se completó revisión visual desktop/móvil ni claro/oscuro. No se creó una nueva preview en esta actualización.
