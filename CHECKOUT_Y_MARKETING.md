# Checkout y marketing de Vitalia

## Implementado en esta versión

El botón «Mi pedido» navega a `/checkout` con el router de Next.js. El checkout es una página propia: productos, sugerencias, datos y resumen. No usa un panel superpuesto. El carrito se conserva en localStorage y se escribe en cada cambio antes de navegar; volver al catálogo mantiene cantidades. El resumen queda al costado en escritorio y debajo en móvil.

Sugerencias opcionales dentro del carrito:
- Cross-sale: hasta tres complementos, uno por categoría relacionada, fuera del carrito y no agotados. Usa los precios y presentaciones del catálogo; «consultar» sigue siendo disponibilidad a consultar.
- Aumento de cantidad: sumar una presentación adicional de un producto elegido, al precio actual. No inventa variantes, combos, ofertas ni ahorro por volumen. Para ofrecer un envase mayor o una alternativa premium habrá que definir explícitamente los SKUs equivalentes.

Las relaciones se editan en `lib/recommendations.js` (`complementaryCategories`). Los productos se eligen en el orden del catálogo, sin rankings de ventas inventados. Respetan 50 productos diferentes y 99 presentaciones por SKU. Cada incorporación invalida el mensaje anterior y vuelve a verificar precios en el servidor.

Pruebas: backend/catálogo, navegación mediante enlaces y persistencia al remontar cada página, cantidades, sugerencias, formulario y conflictos de precio; build Next.js y rutas HTTP. Las pruebas de componentes usan JSDOM y no verifican geometría real ni navegación del navegador. La captura reportada mostró que `.secondary {width:100%}` comprimía el nombre dentro de una fila flex. Las sugerencias ahora usan grid con una columna de texto y un botón de ancho natural; en móvil el botón pasa debajo. Revisar la nueva preview en Safari/Chrome y móvil. No se abrió ni envió WhatsApp.

## Propuesta para 15% de primera compra (aún no activada)

Recomendación: Brevo para campañas y automatizaciones; lógica propia en Next.js + una base de datos privada transaccional para clientes, carritos, pedidos y cupones. Mantener Sheets público únicamente para catálogo. No guardar emails, nombres de clientes ni códigos de cupón en esa planilla.

Planes consultados el 7/10/2026:
- Brevo Free: 300 emails por día, hasta 100.000 contactos almacenados y automatizaciones de marketing para hasta 2.000 contactos.
- Omnisend Free: 500 emails por mes y flujos de bienvenida/abandono. Su generación automática de códigos depende de Shopify, BigCommerce o WooCommerce. Para tiendas propias, los códigos y sus restricciones se controlan desde la tienda.

Fuentes oficiales:
https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans
https://developers.brevo.com/guides/track-website-activity
https://www.omnisend.com/pricing/
https://support.omnisend.com/en/articles/6091933-ecommerce-platforms-add-configure-discount-item

## Flujo propuesto

1. El cliente solicita el beneficio completando nombre y email. Antes de guardar mostrar el uso de los datos, la política de privacidad y opciones claras de suscripción. No suscribir automáticamente por escribir un dato en el checkout. Las campañas requieren una preferencia explícita registrada, con baja disponible.
2. Verificar el email con un enlace; nunca mostrar ni generar un código antes de recibir nombre y email válidos. Verificar evita emitir beneficios a direcciones ajenas o inexistentes.
3. El servidor consulta historial de compras confirmadas e identifica al cliente. Si tiene compras previas, no emite el beneficio. Si ya tiene un cupón disponible, devuelve ese mismo cupón: repetir la solicitud no genera uno nuevo.
4. Emitir un código aleatorio único vinculado al cliente, 15%, un uso, exclusivo para primera compra. Sin tope monetario, mínimo de compra ni vencimiento comercial añadidos. Propuesta de base de cálculo: subtotal de productos; envío se coordina aparte. Mostrar subtotal, descuento y total final, con redondeo a centavos en el servidor.
5. Aplicar el código solo desde el backend, verificando identidad, historial, estado y cálculo. Restricción única por cliente para esta promoción. Reservar el cupón en una transacción al crear el pedido para impedir dos pedidos simultáneos con el mismo beneficio. Reintentos del mismo pedido deben ser idempotentes.
6. Pedido por WhatsApp sigue pendiente: preparar el mensaje o abrir WhatsApp NO demuestra compra ni envío. Crear un identificador de pedido y un panel privado para que la tienda marque confirmado o cancelado. Confirmar consume el cupón y registra la primera compra en la misma transacción. Cancelar libera la reserva. Una reserva técnica temporal no debe anunciarse como vencimiento del beneficio ni cambiar las condiciones comerciales.
7. Registrar carrito actualizado/vaciado e identificar su dueño solo cuando proporcionó sus datos para este flujo. Un link con token opaco permite recuperar el carrito sin exponer email en la URL. Al recuperar, recalcular disponibilidad y precios; no confiar en el importe guardado.
8. Automatización propuesta: recordatorios tras 2 y 24 horas de inactividad, sin crear nuevos descuentos. Detenerla si se vacía el carrito, se da de baja, se confirma la compra o la tienda marca el pedido recibido por WhatsApp; reanudar solo cuando corresponda. Enviar `order_completed` a Brevo al confirmar, nunca al abrir WhatsApp. Usar una cola de eventos con reintentos para no perder la confirmación.

Un email verificado no equivale a una persona única: alguien puede usar otro email. Para limitar el beneficio por cliente real conviene relacionar también el teléfono con el historial confirmado. No prometer que un cupón por email impide todos los registros duplicados.

## Datos mínimos privados

- Clientes: ID, nombre, email normalizado/verificado, teléfono si se incorpora, preferencias/consentimiento y fecha, historial de compra.
- Cupones: ID/código, cliente, promoción primera compra, porcentaje 15, estado, pedido reservado/consumido. Restricciones únicas y actualizaciones atómicas.
- Carritos: ID, cliente, SKU/cantidades, actualización, estado y token de recuperación.
- Pedidos: ID, cliente, líneas/precios verificados, subtotal, descuento, total, cupón y estado pendiente/recibido/confirmado/cancelado.
- Eventos pendientes: identificador idempotente, tipo, pedido/carrito y estado de entrega a Brevo.

## Qué falta para activar

Elegir/provisionar la base privada; crear la cuenta de Brevo y configurar dominio/remitente y credencial de servidor; implementar formulario, verificación, cupones, recuperación y panel privado de confirmación. Probar simultaneidad y reintentos, compras anteriores, códigos ajenos, bajas y suspensión del recupero. No se crean cuentas ni se envían emails en esta versión; el checkout permanece en modo prueba.

No conviene construir desde cero el envío de campañas, reputación del remitente, gestión de bajas y automatizaciones. Sí conviene controlar pedidos y cupones en nuestra propia aplicación porque el checkout termina en WhatsApp.
