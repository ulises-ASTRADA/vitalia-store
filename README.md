# Vitalia · Next.js + React + Chakra UI

Tienda mayorista en español con catálogo público de Google Sheets, búsqueda sin distinguir tildes, categorías, ordenamiento, detalle de producto, carrito persistente, modo claro/oscuro y checkout por WhatsApp en modo de prueba.

## Ejecutar

Requiere Node.js 24. Desde la carpeta del proyecto:

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Abrir http://localhost:3000. La configuración de ejemplo consulta la planilla pública ya conectada. Para revisar exclusivamente la copia local del catálogo, cambiar PREVIEW_MODE=true. Nunca usar esa copia como reemplazo silencioso de la planilla en producción.

```bash
npm test
npm run test:ui
npm run build
npm run test:http
npm start
```

## Arquitectura

- `app/`: página, layout y rutas Next.js `/api/catalog` y `/api/checkout`.
- `components/`: interfaz React, componentes Chakra y proveedor de estilos/temas.
- `server/`: handlers HTTP compartidos con las pruebas.
- `lib/`: lectura y validación del catálogo y generación del mensaje.
- `public/images/`: fotos y logo originales.
- `data/`: catálogo local y auditoría de extracción.
- `catalogo/Catalogo_Vitalia.xlsx`: catálogo actualizado y transcripción original para revisión.

Chakra UI se usa para botones, campos, selector, diálogo de producto/ayuda y drawer del carrito. Next.js se compila con webpack según la guía de integración de Chakra/Emotion. Los temas utilizan next-themes y mantienen la clave `vitalia-theme`; el carrito conserva `vitalia-cart-v1` para recuperar los datos anteriores del mismo dominio.

## Catálogo y datos

Planilla pública: https://docs.google.com/spreadsheets/d/1A91ud3m6bhslJ8EA8yIOSob62Sri2I9UOXZxtcBzi84/edit

La pestaña Productos contiene 293 productos activos y nueve columnas públicas. La transcripción original y el Excel conservan 295 productos, incluidos dos inactivos (N161 y N166). La planilla pública es independiente de la original: los cambios de la tienda se hacen en la pública.

Columnas: `id`, `nombre`, `descripcion`, `categoria`, `precio`, `presentacion`, `imagen`, `disponibilidad`, `activo`.

No cambiar los IDs. Los precios son números por presentación y no deben incluir el signo de moneda dentro del valor. Las categorías tienen un dropdown con los valores existentes. Se conservan las correcciones solicitadas: KG, GR, unidades y los valores 1 KG autorizados para presentaciones antes sin confirmar. Las observaciones históricas de auditoría se mantienen; disponibilidad sigue como consultar y no se inventa stock.

La tienda consulta Sheets desde el servidor, con caché de 60 segundos y nueva consulta al preparar el pedido. Si falla el acceso público, el checkout falla explícitamente. La lectura pública no requiere una cuenta de servicio. El código mantiene soporte opcional para acceso privado por credenciales del servidor.

## Checkout de prueba

Destino: 5493512136078. Nombre, localidad y provincia obligatorios. El servidor vuelve a validar IDs, cantidades, precios y disponibilidad; el cliente no determina el total final. El mensaje incluye `PEDIDO DE PRUEBA — NO CONFIRMAR` y `A confirmar: disponibilidad, envío y forma de pago.`

Preparar el pedido no envía mensajes. WhatsApp solo se abre al hacer clic en su enlace y requiere el envío manual del usuario. Las verificaciones no deben abrir ni enviar mensajes reales.

## Despliegue

Seguir `CONTINUAR_DESPLIEGUE.md`. Esta versión cambia la estructura del proyecto: reemplazar solamente `public` ya no alcanza.

## Verificación de esta migración

Pasaron las 13 pruebas de catálogo/pedidos, tres pruebas de interfaz React/Chakra con DOM simulado y una verificación HTTP contra Next.js compilado (página, catálogo local de 293 activos, checkout de prueba, campos obligatorios y precios manipulados). Las pruebas de interfaz cubren búsqueda, ordenamiento, categorías, detalle, carrito persistente, cantidades, invalidación del mensaje al editar y tema persistente.

Se verificó además la lectura real de Google Sheets: source=sheets, 293 activos y testCheckout=true.

La revisión visual en navegador y el despliegue de una preview nueva deben completarse desde la computadora del usuario: el entorno de esta sesión no pudo iniciar el navegador automatizado y no dispone de una acción para subir el proyecto a Vercel. No se enviaron mensajes de WhatsApp.

## Checkout y sugerencias

### Boxes Vitalia

El catálogo incluye BOX Vitalia (desayuno/merienda), Vitalia Work (trabajo/estudio), Box Enérgico y el Box del mes pendiente de definición. Cada box es una selección ajustable de los SKUs existentes; no crea productos ni modifica precios, stock o presentaciones. No incluye packaging de regalo.

«No sé qué elegir» pregunta destinatario, dulce/salado/variado, objetivo, presupuesto máximo opcional e ingredientes a evitar. Mientras no se definan los tres rangos, el presupuesto se ingresa como un monto libre en pesos. La propuesta elige una presentación por producto, prioriza opciones económicas y distintas familias del box y respeta el monto indicado. Se pueden quitar productos antes de aceptar. Los filtros de ingredientes usan el nombre y la descripción disponibles, sin garantizar ausencia de alérgenos o trazas.

El carrito cambia solo al hacer clic en «Agregar selección al pedido». La operación comprueba límites antes de guardar, evitando adiciones parciales, y conserva el carrito al navegar a `/checkout`. No se activan descuentos adicionales para los boxes; la oferta existente del checkout sigue siendo independiente. Lógica: `lib/boxes.js`; interfaz: `components/box-builder.jsx`.

Mi pedido enlaza a `/checkout`, una página propia con el router de Next.js. El carrito se conserva al navegar, volver y recargar. Incluye complementos opcionales según categoría, con 10% en la primera presentación aceptada desde una sugerencia mientras se conserve su acompañante. El precio original del catálogo no cambia; `lib/cart-offers.js` calcula el ahorro compartido por cliente y servidor. Las unidades adicionales desde los controles normales mantienen el precio del catálogo. La oferta se guarda en `vitalia-cart-offers-v1`, conservando el formato anterior de `vitalia-cart-v1`. Se retiró el bloque de sumar otra presentación y el enlace inferior «Seguir eligiendo». Ver `lib/recommendations.js` para ajustar relaciones y `CHECKOUT_Y_MARKETING.md` para la propuesta de emails, recupero y cupón de primera compra. La promoción de 15% todavía no está conectada ni habilitada.

## Carga y caché

El catálogo se obtiene en el servidor y las primeras 24 tarjetas ya están en el HTML. Next.js conserva página y datos mediante ISR con revalidación de 60 segundos. La primera visita tras ese intervalo puede recibir la versión anterior mientras se regenera en segundo plano; no es una garantía de actualización exacta al minuto. Si falla Google durante una revalidación, se conserva la última versión correcta. La primera compilación necesita acceso a la fuente configurada y falla si no puede leerla; no se sustituye silenciosamente por la copia del PDF.

El navegador no repite `/api/catalog` al hidratar cuando ya recibió los datos iniciales. Al detectar un cambio durante el checkout, vuelve a solicitar el catálogo y exige revisar el pedido. El checkout sigue usando `getCatalog({fresh:true})` y el acceso público a Sheets conserva `cache: no-store`; no usa el caché de render.

Next/Image optimiza las fotos locales con tamaños de pantalla y WebP. Los originales se conservan para los documentos y como fuente de las imágenes del detalle. Las URLs de imágenes externas mantienen el comportamiento anterior; para optimizarlas habrá que configurar sus dominios autorizados. El logo web y el favicon pequeños se regeneran durante `npm run build`. Los diálogos de detalle/ayuda se cargan al usarlos.

`deploy:prueba` ahora pasa configuración pública tanto mediante `--env` como `--build-env`, porque ISR genera el catálogo durante el build. Usar este comando para las previews y añadir `-- --prod` solo después de revisarlas. Si se despliega desde Git en vez del comando, configurar las mismas variables en el entorno correspondiente de Vercel.

Verificación local: `npm test`, `npm run test:ui`, `npm run build`, `npm run test:http`. La prueba HTTP requiere compilar y ejecutar con la misma configuración de prueba: para usar la copia local, compilar con `PREVIEW_MODE=true ALLOW_TEST_CHECKOUT=true WHATSAPP_NUMBER=5493512136078 npm run build`. Comprueba tarjetas sin JavaScript, ISR y optimización de una foto, además del checkout. Los tiempos de carga reales y Core Web Vitals deben medirse en la nueva preview desde Córdoba; las verificaciones locales no los sustituyen.


## Checkout con router

La ruta `/checkout` comparte el catálogo de servidor con ISR de 60 segundos. El carrito privado se restaura en el navegador; el HTML almacenado no contiene cantidades ni datos personales. Los cambios se guardan inmediatamente en localStorage. El checkout tiene columnas de contenido/resumen en escritorio y una sola columna en móvil. Los botones de sugerencias tienen ancho natural y pasan a otra fila en móvil: la regla genérica de ancho completo ya no comprime los nombres.

Ante un conflicto de precio o disponibilidad, el checkout solicita `/api/catalog?fresh=1`, que omite el caché de catálogo, y exige revisar el pedido actualizado antes de preparar otro mensaje. Las compras siguen en modo prueba.
