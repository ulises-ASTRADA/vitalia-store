# Desplegar la versión Next.js + React + Chakra UI

## 1. Usar el proyecto completo

Extraer el ZIP en una carpeta nueva y abrir Terminal dentro de `vitalia-store`. No mezclar esta versión con la antigua: ya no se usan el `api/` de raíz, el HTML de `public` ni la salida `dist/`.

Requiere Node.js 24.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Abrir http://localhost:3000 y revisar catálogo, búsqueda, cantidades, carrito y temas. Detener el servidor con Ctrl+C antes del despliegue.

## 2. Vincular el proyecto existente

```bash
npx vercel login
npx vercel link --scope ulisesastrada1-9233s-projects
```

En Vercel, Settings → Build and Deployment:

- Framework Preset: Next.js.
- Desactivar cualquier override antiguo de Output Directory que diga `dist`.
- Build Command: `npm run build` (el archivo vercel.json también lo declara).
- Install Command: automático.
- Root Directory: carpeta del proyecto donde están package.json y app/.
- Node.js: 24.x.

El código no requiere cuenta de servicio ni claves de Google. La fuente sigue siendo la planilla pública:
https://docs.google.com/spreadsheets/d/1A91ud3m6bhslJ8EA8yIOSob62Sri2I9UOXZxtcBzi84/edit

## 3. Publicar primero una preview

```bash
npm test
npm run build
npm run deploy:prueba
```

El comando incluye la planilla pública, el número de WhatsApp y ALLOW_TEST_CHECKOUT=true. Se mantiene el checkout de prueba.

Si la preview pide iniciar sesión, revisar Settings → Deployment Protection. Para hacerla pública, deshabilitar la protección de esa preview según las opciones disponibles del plan. La protección es una configuración de Vercel, independiente de la aplicación.

## 4. Actualizar la URL principal después de revisar

```bash
npm run deploy:prueba -- --prod
```

Seleccionar el proyecto existente al vincular. Usar --prod publica en su URL principal, manteniendo el checkout de prueba. El cambio de marca no cambia automáticamente el dominio: si querés una URL nueva, agregala desde Settings → Domains en Vercel.

## 5. Verificar

`/api/catalog` debe indicar source=sheets y settings.testCheckout=true, y reflejar los productos activos de la planilla (293 al momento de la migración). Buscar un producto, agregar y quitar cantidades, recargar para comprobar el carrito, cambiar tema y preparar un pedido con nombre/localidad/provincia. Revisar total, destino 5493513947394 y marcador PEDIDO DE PRUEBA — NO CONFIRMAR. No enviar el mensaje.

Si cambian precios o disponibilidad, revisar el carrito y preparar nuevamente el pedido. La tienda no cobra ni reserva stock.

## Identidad Vitalia

El logo, las etiquetas, los mensajes y STORE_NAME ahora usan Vitalia. Si ya existe una variable STORE_NAME en Vercel, actualizarla a Vitalia para Preview y Production. El comando deploy:prueba también configura el nombre para el despliegue actual. No reemplazar .env.local con una configuración vieja.

## Actualización de etiquetas Vitalia

46 fotos actualizadas mediante montaje del logo. Los ingredientes, las tablas nutricionales y el resto de cada imagen se conservan fuera de las zonas de marca.

Tu carpeta local:

```bash
cd /Users/ulises/Desktop/projects/ecom-mily/vitalia-store
```

Para aplicar solo estas fotos, reemplazar `public/images` con la carpeta del ZIP actualizado. Después ejecutar `npm run deploy:prueba` para publicar la preview. El checkout permanece en modo de prueba.

## Actualización de rendimiento (ISR e imágenes)

Copiar el código completo de esta versión, conservando `.env.local` y `.vercel`. El script `deploy:prueba` configura Sheets, Vitalia y checkout de prueba tanto al compilar como al ejecutar.

```bash
cd /Users/ulises/Desktop/projects/ecom-mily/vitalia-store
npm ci
npm run deploy:prueba
```

Usar el proyecto ya vinculado `vitalia-store`. La preview nueva debe mostrar las primeras tarjetas en el HTML (también con JavaScript deshabilitado). En DevTools → Network, las fotos locales usan `/_next/image` y el logo usa `logo-web.webp`. Revisar carrito y checkout sin enviar WhatsApp. Los cambios de Sheets se reflejan al revalidar: después de 60 segundos una visita inicia la actualización en segundo plano. No es un plazo máximo de 60 segundos y una pestaña abierta no se refresca sola.

Para el dominio principal, después de revisar: `npm run deploy:prueba -- --prod`. No usar `vercel --prod` a secas si las variables no están configuradas en el proyecto: el comando completo conserva la configuración del build.


## Checkout en página propia

Esta versión elimina el carrito superpuesto. «Mi pedido» navega a `/checkout`; «Volver al catálogo» y «Seguir eligiendo» vuelven conservando cantidades. Copiar todos los archivos del ZIP actualizado y conservar `.env.local` y `.vercel`.

```bash
cd /Users/ulises/Desktop/projects/ecom-mily/vitalia-store
npm ci
npm run deploy:prueba -- --force
```

Revisar la NUEVA URL de preview, no una preview anterior. Verificar `/checkout` directo, pedido vacío, agregar sugerencias con nombres largos, cantidades, quitar, volver/recargar y datos obligatorios. En móvil los botones de sugerencias se muestran debajo del texto. Preparar el mensaje sin abrir ni enviar WhatsApp. Después de revisar, `npm run deploy:prueba -- --prod` actualiza el dominio principal.
