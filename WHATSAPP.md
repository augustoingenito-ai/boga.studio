# WhatsApp Business · Configuración de la API oficial

La integración está implementada en el CRM, pero no está conectada a una cuenta real hasta completar estos pasos. El proyecto no contrata proveedores ni activa campañas. La validación local usa respuestas simuladas de Meta, sin enviar mensajes reales.

## Cuenta y número

1. Entrar en https://developers.facebook.com/apps y crear una app con el caso de uso/producto **WhatsApp**. Meta puede solicitar una cuenta de desarrollador y un portfolio comercial.
2. Para la primera validación, usar el número de prueba que ofrece Meta en **WhatsApp → API Setup / Configuración de la API**. Agregar el teléfono de prueba como destinatario autorizado según indique el panel.
3. Antes de conectar el número que ya se usa en WhatsApp Business móvil, comprobar si el onboarding de esa cuenta permite **coexistencia**. No basta con registrar el mismo número como si fuera nuevo. El alta de coexistencia puede requerir un flujo Embedded Signup compatible o un proveedor autorizado; este CRM no implementa ese onboarding. Si no está disponible, definir una migración o un número diferente antes de modificar la cuenta actual.

No se importa automáticamente el historial del celular. Esta versión registra nuevos eventos del campo `messages`; no implementa la sincronización histórica ni los eventos especiales de mensajes enviados desde la app móvil en modalidad de coexistencia.

## Variables en Render

En el servicio `boga-studio`, abrir **Environment → Edit** y agregar estos valores de la misma app/cuenta de Meta. No compartir valores privados en chat o GitHub.

| Variable | Valor |
| --- | --- |
| `WHATSAPP_PHONE_NUMBER_ID` | Identificador **Phone number ID**, no el teléfono escrito con +. |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | **WhatsApp Business Account ID** (WABA), no el identificador del portfolio comercial. |
| `WHATSAPP_API_VERSION` | Versión de Graph API admitida que muestra/configura Meta, con formato `vXX.X`. No se supone automáticamente una versión actual. |
| `WHATSAPP_ACCESS_TOKEN` | Token de acceso con permisos `whatsapp_business_messaging` y `whatsapp_business_management`, asignado a los activos correctos. El token temporal del panel sirve para pruebas, pero vence; preparar un token de usuario del sistema y su rotación para uso estable según los requisitos de Meta. |
| `WHATSAPP_APP_SECRET` | Secreto de la app, en su configuración básica. Se usa para verificar la firma de los eventos. |
| `WHATSAPP_VERIFY_TOKEN` | Texto aleatorio privado elegido por vos; se repetirá al registrar el webhook. No es el token de acceso ni la contraseña del CRM. |

Guardar las variables y desplegar el último commit. La integración es opcional: si no está configurada, los otros módulos del CRM siguen funcionando.

## Webhook y suscripción

1. Abrir la app BOGA online antes de verificar el webhook, para que el servicio gratuito de Render ya esté iniciado.
2. En la configuración de WhatsApp/Webhooks de Meta, registrar:
   - **Callback URL:** `https://boga-studio.onrender.com/webhooks/whatsapp`
   - **Verify token:** exactamente el valor de `WHATSAPP_VERIFY_TOKEN` guardado en Render.
3. Verificar y guardar. Suscribirse al campo **messages** para recibir mensajes y confirmaciones de entrega.
4. Ingresar al CRM → **WhatsApp → Probar conexión**. Esto verifica el número con Meta; no prueba por sí solo el webhook.
5. Pulsar **Activar recepción**. Esto solicita a Meta la suscripción de la app al WABA mediante `/{WABA_ID}/subscribed_apps`. Requiere el token y permisos correspondientes.
6. Desde el destinatario autorizado, enviar un mensaje al número de prueba de Meta. Debe aparecer en el CRM, junto con la ficha del cliente. Luego responder desde el CRM y comprobar la recepción en el teléfono. Revisar estados aceptado → enviado → entregado → leído si Meta los emite.

No registrar el webhook en `/api/whatsapp/...`: esas rutas requieren login. El webhook público es exclusivamente `/webhooks/whatsapp`; las notificaciones POST se autentican con HMAC SHA-256 usando el cuerpo original y el secreto de la app.

## Funcionamiento y límites

- Los contactos se vinculan por coincidencia exacta del teléfono internacional normalizado. Guardar números con `+` y código de país. Si no hay una única coincidencia, se crea una ficha WhatsApp estable; no se infiere que dos teléfonos diferentes pertenecen a la misma persona.
- Los mensajes se guardan en PostgreSQL mediante la tabla existente de registros; no se borran ni reemplazan datos del CRM. Los respaldos JSON incluyen mensajes y estados. Los respaldos anteriores sin WhatsApp siguen siendo compatibles.
- La bandeja consulta mensajes cada diez segundos mientras está abierta. No hay notificaciones push. Render Free puede suspenderse por inactividad y retrasar la recepción/verificación. Las entregas dependen también de Meta y sus reintentos; no se garantiza disponibilidad continua en el plan gratuito.
- Se envían únicamente respuestas de texto dentro de las 24 horas posteriores al último mensaje recibido del cliente. Una nota manual no abre esa ventana. Fuera de ella, el servidor rechaza el envío. Las plantillas, campañas, adjuntos salientes y envío automático del PDF de presupuesto quedan para una etapa posterior.
- Imágenes, documentos, audio y otros contenidos entrantes se registran como un aviso de contenido recibido; no se descargan ni reproducen los archivos dentro del CRM.
- Un envío aceptado por Meta no se presenta como entregado: el estado cambia con los webhooks. Un timeout se marca sin confirmación y no se reintenta automáticamente. Revisar WhatsApp antes de decidir enviar otra vez para evitar duplicados.
- La entrega repetida de un webhook no duplica el mensaje; los estados fuera de orden no retroceden de leído a enviado. El servidor no registra tokens ni el contenido de los chats en los logs.
- Meta puede cobrar determinados mensajes según las condiciones, categoría y destino. Confirmar las condiciones de la cuenta en https://developers.facebook.com/docs/whatsapp/pricing. La app no habilita automáticamente plantillas o campañas ni contrata planes pagos.

## Validación

`npm test` y `TEST_DB_DRIVER=pglite npm test` verifican el CRM y la integración con Meta simulada: firmas, duplicados, asociación del cliente, límite de 24 horas, payload de envío, estados desordenados, timeout, autenticación y bandeja móvil. La conexión, permisos, coexistencia y tráfico real quedan pendientes hasta completar el onboarding en la cuenta de Meta y desplegar las variables correctas.
