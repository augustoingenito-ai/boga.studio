# Acceso online privado con Render

El despliegue requiere una cuenta de Render con acceso al repositorio de GitHub y un plan **de pago** con disco persistente. Render ofrece la dirección HTTPS temporal; no hace falta comprar un dominio. La configuración de este repositorio no crea ni contrata servicios automáticamente.

1. En Render, elegir **New → Blueprint**, conectar GitHub y seleccionar `augustoingenito-ai/boga.studio`, rama `main`.
2. Render lee `render.yaml`: un servicio Node, plan Starter y disco persistente de 1 GB en `/var/data`. Revisar el precio que muestra Render antes de crear el servicio.
3. Definir `ADMIN_USERNAME` y una `ADMIN_PASSWORD` única de al menos 12 caracteres en el formulario seguro de Render. No compartirla por chat ni incluirla en Git. Es el único usuario de esta versión.
4. Crear el servicio. Al finalizar, Render muestra la dirección `https://…onrender.com`. La app utiliza `RENDER_EXTERNAL_URL` para sus cookies y comprobaciones de origen. Si luego se conecta un dominio propio, definir `APP_URL` con su dirección HTTPS canónica.
5. Abrir la dirección HTTPS e iniciar sesión. Comprobar el flujo: cliente → presupuesto → aprobar → crear trabajo → registrar cobro. La base online empieza vacía.
6. Si había datos locales: usar `Respaldar`, detener el servidor destino y ejecutar `DATA_DIR=/var/data node scripts/restore.js /ruta/respaldo.json` con una base destino vacía. No sobreescribir registros existentes. Los bocetos se incluyen en el JSON.

## Actualizaciones

El despliegue automático está desactivado intencionalmente. Después de revisar y subir cambios, elegir **Manual Deploy → Deploy latest commit** en Render. El disco conserva los datos entre reinicios y despliegues del mismo servicio. No borrar el disco ni mover `DATA_DIR` al directorio del código.

No se necesita `npm install` en la máquina personal ni una cuenta de Meta para usar este CRM. WhatsApp sigue pendiente de integración.

## Respaldos y recuperación

- El servidor crea una copia SQLite al iniciar y cada 24 horas. Conserva las últimas 14 fechas en `/var/data/backups/`. El servidor debe permanecer en ejecución para el respaldo programado; no son copias externas al proveedor.
- Descargar periódicamente `Respaldar` desde la app y guardar el JSON fuera de Render. Incluye clientes, presupuestos, trabajos, notas y bocetos, sin contraseña ni sesiones. Las copias en el mismo disco no protegen contra la pérdida del disco o de la cuenta.
- Restauración SQLite: detener la app, conservar la carpeta actual, copiar una copia diaria a `boga.sqlite` dentro de un directorio de datos nuevo sin archivos WAL/SHM antiguos, y reiniciar con ese directorio.
- Restauración JSON: con la app detenida y una base vacía, usar el script anterior. La restauración rechaza bases con datos.
- Para cambiar el acceso, modificar las credenciales en Render y reiniciar. Las sesiones anteriores se invalidan. La cookie de sesión dura hasta siete días y se elimina al cerrar sesión.

La app admite una sola instancia con un disco SQLite. No configurar varias réplicas. `/healthz` comprueba el servidor y la base sin exponer datos de clientes. El inicio de sesión limita los intentos fallidos; después de diez intentos, esperar quince minutos.

## Estado de verificación

La autenticación, persistencia, respaldo/restauración y circuito del CRM se validan con pruebas locales. Hasta conectar una cuenta y completar el despliegue, no hay una URL pública ni una validación del servicio de Render.
