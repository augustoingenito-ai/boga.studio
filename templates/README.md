# Plantillas de presupuesto BOGA

`design.pdf`, `branding.pdf`, `collection.pdf` y `monthly.pdf` son copias byte por byte de los PDF aportados por la usuaria:

- PRESUPUESTO EDITABLE.pdf: A4 vertical, 595.276 × 841.89 pt, una página.
- PRESUPUESTO BRANDING.pdf: A4 apaisado, 841.89 × 595.276 pt, doce páginas.
- Propuesta Acompañamiento Menusal.pdf: A4 vertical, 595.276 × 841.89 pt, una página.
- Propuesta Colección.pdf: A4 apaisado, 841.89 × 595.276 pt, doce páginas. Es la última revisión aportada de la propuesta de colección.

`quote-pdf.js` copia sus páginas y agrega campos transparentes, sin reconstruir ni rasterizar el diseño. Se conservan márgenes, encabezados, gráficos, marcas de agua y fuentes originales. Los datos nuevos usan Poppins Regular, salvo el encabezado de Acompañamiento mensual que conserva Sorts Mill Goudy; el importe de Branding y la cantidad de tipologías de Colección usan Coolvetica Regular. Todos los campos completados usan tracking −40 (−0,04 em), incluido en la medición para conservar la alineación. Las fuentes completas están incrustadas para permitir edición posterior. Ver Poppins-LICENSE.txt y [Coolvetica-SOURCE.md](Coolvetica-SOURCE.md).

## Diseño de colección

La propuesta conserva exactamente sus doce páginas, sin anexos ni contenido adicional. Solo se completan tres páginas:

- **Página 1, portada:** nombre del cliente, fecha y validez, junto a sus etiquetas originales, en Poppins y el verde del archivo.
- **Página 9:** la cantidad manual de tipologías reemplaza el 6 de ejemplo en «Creación integral de … tipologías con variante de color e identidad estética.». Usa Coolvetica Regular del tamaño original; el resto de la frase se desplaza según el ancho del número, sin cambiar sus palabras ni superponer el texto.
- **Página 10:** valor del proyecto en Poppins Regular, con el indicador ARS. Con asesoría se muestran subtotal negro, descuento rojo y total verde; sin asesoría, solo el total verde en la primera fila del bloque. Los importes comparten borde derecho y respetan las líneas de base originales.

Los datos conservan los colores de relleno y trazo y los grosores del archivo. La página 8, incluido su cronograma, y las páginas 2–7 y 11–12 permanecen intactas.

El CRM sigue preguntando si hubo asesoría y cuánto se cobró. Ese importe se descuenta una sola vez del subtotal, incluso al editar repetidamente; no se registra como cobro del nuevo presupuesto. Los servicios admiten precios negativos con cantidades positivas. El total neto no puede ser negativo y determina el límite de los cobros.

La referencia, el detalle de servicios, las condiciones, los adicionales y las notas se conservan internamente en el CRM. No se imprimen ni sustituyen textos de la propuesta. Las condiciones y la página de contacto del nuevo documento permanecen como en el original.

`collection-base.pdf` y `collection-no-consultation-base.pdf` retiran únicamente la cantidad de ejemplo de la página 9 y los tres importes de ejemplo de la página 10, incluidos sus trazos. En la variante sin asesoría también se retiran las etiquetas de subtotal y descuento y se mueve la etiqueta TOTAL a la primera fila del bloque. El script conserva los demás operadores y recursos del diseño, sin redacciones gráficas ni rasterización.

## Acompañamiento mensual

`monthly.pdf` conserva el archivo adjunto byte por byte. `monthly-base.pdf` retira solamente el nombre y la fecha de ejemplo y las dos copias (relleno/trazo) del importe de ejemplo. Conserva las etiquetas Cliente, Fecha y TOTAL, todos los servicios, el horario, las condiciones de pago, los logos y las marcas de agua.

El PDF final o editable siempre tiene una hoja y únicamente tres campos:

- **Cliente:** nombre y marca/empresa separados por « - », si la marca está cargada y es diferente del nombre. Sorts Mill Goudy Regular de 18,5438 pt, con la posición y el color originales.
- **Fecha:** DD/MM/AAAA, con la misma fuente y tamaño del encabezado.
- **Total:** importe en ARS, Poppins Regular de 18 pt, negro, con el trazo original de 0,25 pt y alineación derecha en su recuadro.

Los datos conservan tracking −40 y sus líneas de base originales. La fuente completa Sorts Mill Goudy se incluye para editar nombres y fechas; coincide con la fuente OFLGoudyStM del archivo. Ver [SortsMillGoudy-SOURCE.md](SortsMillGoudy-SOURCE.md) y su licencia OFL.

El formulario mensual permite cargar directamente el importe. El servidor lo calcula a partir de un ítem mensual de cantidad 1 y valida cobros y total como en los demás presupuestos. No aplica asesoría, validez, cronogramas, notas ni anexos al PDF mensual. No crea facturación recurrente.

## Edición y descarga

La vista PDF muestra el archivo real y permite abrirlo en otra pestaña.

- **PDF final:** campos aplanados, listo para enviar; no depende de imprimir HTML.
- **PDF editable:** formulario AcroForm con los datos correspondientes a cada plantilla, rellenable en un lector compatible. No es un archivo de edición gráfica de Illustrator; los gráficos y textos originales siguen formando parte de la plantilla.

El cálculo automático se hace en el CRM. El PDF editable no ejecuta JavaScript: al cambiar cantidades o importes fuera del CRM, deben actualizarse también los totales manualmente. Los cambios del archivo descargado no se sincronizan con la app.

## Diseño y Branding

Diseño mantiene una sola hoja. Conserva la tabla original para hasta dos servicios y adapta sus filas para tres o más. Las condiciones y observaciones se acomodan en su zona inferior. Si un texto o número de servicios no cabe legiblemente, devuelve un error 422 para acortar o agrupar; no recorta información ni agrega páginas.

Branding conserva sus doce páginas. La portada no imprime el nombre del cliente ni el nombre del proyecto. El cronograma se completa en la página 9; el valor del proyecto usa Coolvetica Regular con tracking −40, alineado con la etiqueta original. El detalle de servicios va en el espacio disponible de la página de adicionales. Condiciones particulares, notas y cronogramas extensos pueden generar anexos, como antes. Los bocetos vinculados se descargan por separado.

El nombre del proyecto sigue omitido del formulario y de todos los PDF. Los nombres internos existentes se conservan; los nuevos registros usan su referencia como identificación.

## Preparación y validación

Ejecutar `python scripts/prepare-quote-templates.py` requiere PyMuPDF solo en desarrollo. Produce las tres variantes de Diseño (`design-grid`, `design-terms`, `design-grid-terms`), las dos de Colección y `monthly-base`, sin modificar los originales ni requerir herramientas Python en producción.

Las pruebas verifican el alta, edición y descarga del presupuesto mensual con sus tres campos y fuentes; descargas desde Chromium, asesoría aplicada una sola vez, precios negativos y centavos; doce páginas de colección con datos solo en las páginas 1, 9 y 10, cronograma intacto y cantidades de una a cuatro cifras; campos editables con las fuentes de cada plantilla; salida final aplanada; ausencia de importes de ejemplo y contenido interno; conservación de Diseño en una hoja y Branding con sus doce páginas y anexos. La comparación rasterizada comprueba que los gráficos y las otras páginas no cambian fuera de las zonas de datos.
