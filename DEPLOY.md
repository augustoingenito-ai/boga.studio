# Publicación gratuita: Render + Supabase

La configuración usa **Render Free**, sin disco contratado, y un proyecto **Supabase Free** para persistir los datos. No crea servicios ni contrata planes automáticamente. Ambas cuentas y la conexión deben configurarse antes de obtener un enlace público. Revisar que los formularios indiquen Free y no aceptar upgrades o servicios de pago.

## 1. Crear Supabase Free

1. Crear una cuenta en https://supabase.com/dashboard y un proyecto en una organización **Free**. Conservar la contraseña de la base de datos en un gestor seguro; no compartirla por chat.
2. En **Connect**, seleccionar la conexión **Session pooler**, compatible con IPv4. Copiar la URI PostgreSQL. Conservar la URI original con `[YOUR-PASSWORD]`: la contraseña se cargará por separado como `DATABASE_PASSWORD`, sin codificar. No usar una clave anon, publishable o service-role como contraseña de PostgreSQL.
3. La app crea sus tablas automáticamente al iniciar dentro del esquema `boga_private`. Ese esquema no debe agregarse a la lista de esquemas expuestos por la API de Supabase. No requiere habilitar acceso anónimo ni políticas públicas.

## 2. Crear Render Free

1. Crear una cuenta en https://dashboard.render.com/ y conectar el repositorio GitHub `augustoingenito-ai/boga.studio`.
2. Elegir **New → Blueprint**, rama `main`. `render.yaml` selecciona el plan **free**, sin disco ni base de datos de Render. Revisar que no se añadan servicios pagos.
3. Completar estas variables en el formulario seguro de Render:
   - `DATABASE_URL`: URI completa del Session pooler de Supabase; puede conservar `[YOUR-PASSWORD]`.
   - `DATABASE_PASSWORD`: contraseña real de la base de Supabase, como texto literal, sin codificar ni envolver en comillas. Agregar esta variable manualmente si no aparece en el formulario. Tiene prioridad sobre la contraseña dentro de la URI.
   - `ADMIN_USERNAME`: usuario elegido para ingresar al CRM.
   - `ADMIN_PASSWORD`: contraseña única de entre 12 y 1000 caracteres para ingresar al CRM. Puede ser diferente de la contraseña de Supabase.
4. Crear el servicio y esperar la compilación. Render proporciona su URL HTTPS temporal en `onrender.com`. La app detecta `RENDER_EXTERNAL_URL` automáticamente. Si luego se configura un dominio propio, definir `APP_URL` con la dirección HTTPS canónica.
5. Abrir la URL e iniciar sesión. Probar cliente → presupuesto → aprobación → trabajo → cobro y descargar un respaldo.

La conexión PostgreSQL valida TLS. Si Supabase requiere una CA específica, descargar el certificado desde su panel y configurar su contenido PEM como `DATABASE_CA_CERT` en Render. No usar `rejectUnauthorized=false`, `NODE_TLS_REJECT_UNAUTHORIZED=0` ni otras formas de desactivar la verificación. La conexión al proveedor real no se considera validada hasta que `/healthz` responda correctamente y se pruebe guardar y leer un cliente.

## Datos, archivos y límites

Clientes, presupuestos, trabajos, notas, sesiones y bocetos se guardan en PostgreSQL, fuera del disco temporal de Render. En esta primera versión, los bocetos se guardan codificados dentro de la base, no en un bucket de Supabase Storage. Ocupan aproximadamente un tercio más que el archivo original. Usar archivos livianos y controlar el uso desde Supabase; el límite por archivo sigue siendo 5 MB.

Los planes gratuitos tienen límites y pueden suspenderse por inactividad. Render puede tardar en responder al primer acceso después de un período sin uso. Si Supabase pausa el proyecto, reactivarlo desde su panel. No se usan mecanismos para mantener los servicios despiertos ni se activan upgrades automáticamente desde la app.

## Respaldos y restauración

Descargar periódicamente **Respaldar** desde el CRM y guardar el JSON en un lugar privado fuera de Render y Supabase. Incluye datos y bocetos, sin contraseña ni sesiones. Esta configuración gratuita **no incluye respaldos externos automáticos**. No se guardan copias útiles en el disco temporal de Render.

Para importar un respaldo en un proyecto destino vacío, detener el servidor y ejecutar `node scripts/restore.js /ruta/respaldo.json` desde una máquina con la misma `DATABASE_URL` configurada de forma segura. El script crea las tablas, usa una transacción y rechaza bases con registros; nunca borra los datos existentes. No poner credenciales en comandos compartidos, repositorios o chat.

El desarrollo local conserva SQLite (`data/boga.sqlite`) si no se define `DATABASE_URL`. Solo en ese modo se generan copias SQLite diarias locales. Para trasladar esos datos a Supabase, descargar el JSON con el servidor local, y usar el procedimiento de importación anterior.

## Actualizaciones y verificación

El despliegue automático está desactivado. Revisar los cambios y elegir **Manual Deploy → Deploy latest commit** en Render. Las actualizaciones del código no eliminan los datos de Supabase. Cambiar las credenciales de acceso en Render y reiniciar invalida las sesiones anteriores.

Pruebas locales: `npm test` (SQLite) y `TEST_DB_DRIVER=pglite npm test` (motor PostgreSQL embebido). Las pruebas de PostgreSQL comprueban las consultas y el circuito de la app; no sustituyen la prueba de TLS, permisos, red y persistencia en la cuenta real de Supabase. WhatsApp continúa pendiente.

## Si aparece `password authentication failed` (28P01)

La base rechazó las credenciales; el código por sí solo no puede corregir una contraseña desconocida. Para evitar errores de codificación:

1. Copiar nuevamente la URI de **Connect → Session pooler** del proyecto correcto, sin editar usuario, host ni puerto, y ponerla en `DATABASE_URL`. Se puede dejar el marcador `[YOUR-PASSWORD]`.
2. En Render, agregar `DATABASE_PASSWORD` con la contraseña literal de la base de datos. No es `ADMIN_PASSWORD`, no lleva comillas ni codificación de URL. Si no se conoce la contraseña, restablecerla desde Supabase, guardarla de forma privada y actualizar esta variable.
3. Mantener el certificado oficial en `DATABASE_CA_CERT`.
4. Guardar las variables y elegir **Manual Deploy → Deploy latest commit** para incluir el código que admite la contraseña separada. Verificar que el despliegue use el commit actualizado, no el anterior `39e5049`.

No compartir la contraseña ni la URI con credenciales en capturas o chat. Esta corrección mantiene la verificación TLS y no cambia contraseñas del proveedor automáticamente.
