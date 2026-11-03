# BOGA Studio · CRM

Primera versión para una sola persona: clientes, historial manual de conversaciones, seguimiento, presupuestos de branding, diseño y colección, bocetos adjuntos, cobros y tablero de trabajos.

## Desarrollo

Requiere Node.js 24 o superior. Para desarrollo local usa SQLite sin credenciales externas. Para publicación gratuita usa Render Free y PostgreSQL en Supabase Free.

```sh
npm ci
npm run dev
```

El servidor escucha en `127.0.0.1:3000`. `npm start` inicia sin recarga automática del servidor; los archivos del navegador se leen en cada solicitud. `PORT`, `HOST` y `DATA_DIR` son opcionales. Usar el checkout existente; no hace falta crear worktrees.

## Flujo

1. Crear un cliente y agregar etiquetas, datos de contacto y próximo seguimiento.
2. Crear un presupuesto, elegir Branding, Diseño o Diseño de colección y completar servicios, cantidades, precios y condiciones. Los precios unitarios negativos restan del subtotal; las cantidades deben ser positivas. En colección se pregunta primero si hubo asesoría y cuánto se cobró, y se ingresa manualmente la cantidad de tipologías. La asesoría se descuenta una sola vez del subtotal, sin registrarse como cobro del nuevo presupuesto. El servidor calcula y valida el total neto.
3. Adjuntar un boceto (PDF, PNG, JPEG o WebP, hasta 5 MB). Se guarda junto al presupuesto; puede descargarse desde su vista PDF.
4. Registrar el envío manualmente cambiando el estado a Enviado. Se guarda la fecha de envío (editable si se envió antes) y se agenda un seguimiento 7 días después. Esto no envía mensajes. Al registrar la respuesta del cliente, realizar el seguimiento o cambiar a otro estado, ese recordatorio se cierra.
5. Aprobar el presupuesto, registrar lo cobrado y crear el trabajo desde `+ Trabajo`. Cargar la fecha de próxima revisión y la fecha de entrega; cambiar sus etapas en el tablero. También se pueden crear trabajos sin presupuesto vinculado.
6. Usar PDF para ver la plantilla original completa. Descargar PDF final entrega el documento listo para enviar; Descargar PDF editable conserva campos rellenables. Branding mantiene sus 12 páginas apaisadas y sus anexos opcionales. Diseño y Diseño de colección se descargan en una sola hoja: la tabla de Diseño se adapta para tres o más servicios y colección muestra las tipologías, el subtotal, el descuento por asesoría y el total, sin resumen automático de servicios. Los datos completados usan Poppins con tracking −40. Si el contenido excede una hoja legible, la app pide acortarlo o agrupar servicios antes de descargar. Ver [templates/README.md](templates/README.md).
7. Registrar conversaciones manuales desde la ficha del cliente. Los recordatorios se muestran dentro de la app; no hay notificaciones externas.

Las métricas abarcan todos los registros, sin filtro de período. Los importes se expresan en ARS. Un cliente puede tener múltiples presupuestos y trabajos. El importe cobrado es un acumulado editable, no un libro contable de transacciones.

## Agenda y próximos compromisos

La sección Agenda (antes Seguimientos) incluye un calendario mensual con entregas, revisiones, seguimientos de presupuestos y próximos contactos de clientes. Permite navegar por meses, volver a hoy y ver el detalle de un día. Cada compromiso abre el registro correspondiente y muestra si vence hoy, cuántos días faltan o cuántos días lleva vencido. Los cálculos usan días corridos y la zona horaria de Argentina.

El dashboard muestra hasta cinco próximos trabajos y cinco seguimientos de presupuesto, empezando por los más antiguos. En Brief, Diseño y Revisión se prioriza la fecha de próxima revisión; si falta, se muestra la entrega disponible. En Entrega se prioriza la fecha de entrega y deja de aparecer la revisión anterior. Los trabajos Finalizados salen de los pendientes. El calendario incluye tanto la revisión como la entrega de los trabajos activos, según su etapa. Las fechas se cargan en cada trabajo; no se inventan plazos a partir de las condiciones del PDF. Los registros con fechas pendientes de completar se señalan en la agenda.

Los presupuestos usan `sentOn` como fecha de envío y `followupOn` como fecha calculada a siete días, solo mientras estén Enviados y no tengan `respondedOn` ni `followedUpOn`. Editar el presupuesto no reinicia la cuenta. Volver a Enviado desde otro estado inicia un nuevo envío y permite corregir su fecha. Los botones «Cliente respondió» y «Seguimiento realizado» guardan la fecha y cierran el recordatorio; también se pueden editar esas fechas desde el presupuesto. Este seguimiento es único por envío. En presupuestos antiguos Enviados sin fecha conocida, se pide cargar el envío real: no se usa la fecha de creación como sustituto. La respuesta del cliente se registra manualmente.

## Datos y límites de esta versión

SQLite persiste en `data/boga.sqlite` (ignorado por Git), incluidos los bocetos. Los datos iniciales están vacíos; las pruebas usan una base temporal separada. Para un respaldo consistente, detener el servidor y copiar **la carpeta `data/` completa**; restaurarla con el servidor detenido. No eliminarla al actualizar el código.

El desarrollo local en loopback puede ejecutarse sin login. El acceso remoto (`HOST=0.0.0.0`) exige `ADMIN_USERNAME` y `ADMIN_PASSWORD` de al menos 12 caracteres. En producción (`NODE_ENV=production`) también se exige una dirección HTTPS en `APP_URL` o `RENDER_EXTERNAL_URL`. Hay sesiones privadas de siete días, cierre de sesión y límite de intentos. En producción es obligatorio configurar `DATABASE_URL`; no se usa SQLite en un disco temporal. Los respaldos SQLite diarios son solo locales. Online se descarga el respaldo JSON desde la app. Ver [DEPLOY.md](DEPLOY.md) para publicarla con PostgreSQL persistente en Supabase y guardar copias externas. Los archivos .ai/.psd son formatos de entrega descriptos en las condiciones, no formatos generados por el CRM.

WhatsApp tiene una integración opcional con la API oficial de Meta: bandeja, mensajes entrantes y respuestas de texto dentro de la ventana de 24 horas. Requiere configurar la app de Meta, suscripción y credenciales privadas en Render. Ver [WHATSAPP.md](WHATSAPP.md). No incluye importación histórica, medios descargados, plantillas ni envío automático de presupuestos PDF. La conexión real queda pendiente de configurar y verificar con la cuenta del usuario.

## Identidad

La interfaz usa Coolvetica Regular local en WOFF2 con tracking −18 (−0,018 em), sin síntesis de negritas. Los presupuestos conservan sus tipografías y tracking anteriores, independientes de los estilos del navegador. Procedencia de Coolvetica en [templates/Coolvetica-SOURCE.md](templates/Coolvetica-SOURCE.md).

El logo superior `public/brand/boga-studio-logo.svg` conserva las curvas del logo primario BOGASTUDIO de la hoja 2 del manual, sin fondo. El fondo del bloque de bienvenida `public/brand/dashboard-watermark.svg` extrae los gráficos de la hoja 5, sin sus textos ni cambios de color, transparencia o morfología. Se adapta al bloque manteniendo la proporción y recortando los bordes según su tamaño. Ambos son vectores originales; no se recrean con tipografía. Se regeneran con `python scripts/prepare-ui-brand.py '/ruta/MANUAL DE MARCA.pdf'` (PyMuPDF, lxml, fontTools y Brotli solo en desarrollo).

La esquina inferior del menú muestra el nombre del usuario de la sesión. Al pulsarlo, «Editar mi perfil» permite guardar un nombre como Martina Berraz, con sus iniciales. Los nombres se almacenan en la base por identidad de cuenta y se incluyen en el respaldo y restauración. No se toman del almacenamiento del navegador ni de un nombre fijo en el HTML. La aplicación mantiene el acceso de administrador actual; esta modificación no agrega una pantalla para crear cuentas.

## Validación

```sh
npm test
```

Pruebas Playwright con servidor y SQLite temporales: flujo cliente → conversación → presupuesto de branding con boceto → aprobación y cobro → trabajo; persistencia al recargar; validación de importes y relaciones; navegación móvil. La configuración usa Chromium en `/usr/bin/chromium`. En otras máquinas, instalar Chromium y ajustar `executablePath` en `playwright.config.js`. El controlador `pg` es una dependencia de ejecución; Playwright y PGlite son herramientas de desarrollo. Las pruebas adicionales verifican login, acceso anónimo bloqueado, cierre de sesión, límite de intentos y respaldo/restauración.

## Publicación online

La configuración `render.yaml` prepara un servicio Render Free protegido por login y conectado a Supabase Free para persistir datos y bocetos. Requiere crear ambas cuentas gratuitas y definir la conexión de PostgreSQL; ver [instrucciones completas](DEPLOY.md). La configuración por sí sola no publica el servicio.

Para comprobar el backend PostgreSQL sin una cuenta remota: `TEST_DB_DRIVER=pglite npm test`. PGlite es un motor PostgreSQL embebido solo para pruebas y desarrollo. Las cuentas reales y su TLS requieren una validación de despliegue posterior.

La contraseña de PostgreSQL puede definirse por separado en `DATABASE_PASSWORD` como texto literal. Tiene prioridad sobre la contraseña en `DATABASE_URL` y evita codificar caracteres especiales dentro de la URI. Consultar la sección de errores de conexión de [DEPLOY.md](DEPLOY.md).

Los seis iconos del menú son SVG locales de Font Awesome Free 7.3.1, incluido el símbolo de marca de WhatsApp. Atribución y licencia CC BY 4.0 en `public/icons.js` y `public/icons-LICENSE.txt`. No requieren fuentes ni servicios externos.
