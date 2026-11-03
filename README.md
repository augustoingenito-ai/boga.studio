# BOGA Studio · CRM

Primera versión para una sola persona: clientes, historial manual de conversaciones, seguimiento, presupuestos de branding y diseño, bocetos adjuntos, cobros y tablero de trabajos.

## Desarrollo

Requiere Node.js 24 o superior. Para desarrollo local usa SQLite sin credenciales externas. Para publicación gratuita usa Render Free y PostgreSQL en Supabase Free.

```sh
npm ci
npm run dev
```

El servidor escucha en `127.0.0.1:3000`. `npm start` inicia sin recarga automática del servidor; los archivos del navegador se leen en cada solicitud. `PORT`, `HOST` y `DATA_DIR` son opcionales. Usar el checkout existente; no hace falta crear worktrees.

## Flujo

1. Crear un cliente y agregar etiquetas, datos de contacto y próximo seguimiento.
2. Crear un presupuesto, elegir Branding o Diseño, completar servicios, cantidades, precios y condiciones. El total se calcula en el servidor.
3. Adjuntar un boceto (PDF, PNG, JPEG o WebP, hasta 5 MB). Se guarda junto al presupuesto; puede descargarse desde su vista PDF.
4. Registrar el envío manualmente cambiando el estado a Enviado. Esto no envía mensajes.
5. Aprobar el presupuesto, registrar lo cobrado y crear el trabajo desde `+ Trabajo`. Cambiar sus etapas en el tablero.
6. Usar PDF → Imprimir / Guardar PDF para obtener el documento. Activar los fondos gráficos en el diálogo de impresión si se desea conservar el color. La propuesta de branding incluye las seis etapas del PDF de referencia; el diseño incluye las condiciones de pago y revisiones del otro modelo. Ambas condiciones son editables.
7. Registrar conversaciones manuales desde la ficha del cliente. Los recordatorios se muestran dentro de la app; no hay notificaciones externas.

Las métricas abarcan todos los registros, sin filtro de período. Los importes se expresan en ARS. Un cliente puede tener múltiples presupuestos y trabajos. El importe cobrado es un acumulado editable, no un libro contable de transacciones.

## Datos y límites de esta versión

SQLite persiste en `data/boga.sqlite` (ignorado por Git), incluidos los bocetos. Los datos iniciales están vacíos; las pruebas usan una base temporal separada. Para un respaldo consistente, detener el servidor y copiar **la carpeta `data/` completa**; restaurarla con el servidor detenido. No eliminarla al actualizar el código.

El desarrollo local en loopback puede ejecutarse sin login. El acceso remoto (`HOST=0.0.0.0`) exige `ADMIN_USERNAME` y `ADMIN_PASSWORD` de al menos 12 caracteres. En producción (`NODE_ENV=production`) también se exige una dirección HTTPS en `APP_URL` o `RENDER_EXTERNAL_URL`. Hay sesiones privadas de siete días, cierre de sesión y límite de intentos. En producción es obligatorio configurar `DATABASE_URL`; no se usa SQLite en un disco temporal. Los respaldos SQLite diarios son solo locales. Online se descarga el respaldo JSON desde la app. Ver [DEPLOY.md](DEPLOY.md) para publicarla con PostgreSQL persistente en Supabase y guardar copias externas. Los archivos .ai/.psd son formatos de entrega descriptos en las condiciones, no formatos generados por el CRM.

WhatsApp está explícitamente pendiente: no hay envío, recepción, sincronización ni importación histórica. Se integrará mediante la API oficial de Meta en una etapa posterior. Tampoco se envían emails o recordatorios automáticos.

## Identidad

Colores del manual: `#EFB6CC`, `#06B26D`, `#000000`, `#FFFFFF`, `#FFFCF2`. Poppins local para interfaz y Goudy Bookletter 1911 para títulos. Esta última es una variante de Goudy, no la fuente exacta OFL Goudy StM del PDF; puede reemplazarse cuando se disponga del archivo autorizado de la fuente. El logotipo del encabezado es una composición tipográfica provisional, no un vector extraído del manual. Fuentes distribuidas con sus licencias en `public/fonts/`.

## Validación

```sh
npm test
```

Pruebas Playwright con servidor y SQLite temporales: flujo cliente → conversación → presupuesto de branding con boceto → aprobación y cobro → trabajo; persistencia al recargar; validación de importes y relaciones; navegación móvil. La configuración usa Chromium en `/usr/bin/chromium`. En otras máquinas, instalar Chromium y ajustar `executablePath` en `playwright.config.js`. El controlador `pg` es una dependencia de ejecución; Playwright y PGlite son herramientas de desarrollo. Las pruebas adicionales verifican login, acceso anónimo bloqueado, cierre de sesión, límite de intentos y respaldo/restauración.

## Publicación online

La configuración `render.yaml` prepara un servicio Render Free protegido por login y conectado a Supabase Free para persistir datos y bocetos. Requiere crear ambas cuentas gratuitas y definir la conexión de PostgreSQL; ver [instrucciones completas](DEPLOY.md). La configuración por sí sola no publica el servicio.

Para comprobar el backend PostgreSQL sin una cuenta remota: `TEST_DB_DRIVER=pglite npm test`. PGlite es un motor PostgreSQL embebido solo para pruebas y desarrollo. Las cuentas reales y su TLS requieren una validación de despliegue posterior.
