# Plantillas de presupuesto BOGA

`design.pdf`, `branding.pdf` y `collection.pdf` son copias byte por byte de los PDF aportados por la usuaria:

- PRESUPUESTO EDITABLE.pdf: A4 vertical, 595.276 × 841.89 pt, una página.
- PRESUPUESTO BRANDING.pdf: A4 apaisado, 841.89 × 595.276 pt, doce páginas.
- Propuesta Coleccion Editable.pdf: A4 vertical, una página.

`quote-pdf.js` copia sus páginas y agrega campos transparentes, sin reconstruir ni rasterizar el diseño. Se conservan márgenes, encabezados, tablas, marcas de agua, gráficos y las fuentes originales incrustadas (incluidas Goudy, Coolvetica y las marcas). Los datos nuevos usan Poppins Regular completo, descargado del repositorio oficial google/fonts, con licencia en Poppins-LICENSE.txt; el importe de «valor del proyecto» en Branding usa Coolvetica Regular. Todos los campos que completa el CRM usan tracking −40 (−0,04 em), tanto en las apariencias del PDF final como en los campos editables. El ajuste se incluye en la medición del texto para conservar la alineación. En colección con asesoría, únicamente los importes del subtotal, descuento y total se muestran en negro, rojo y verde, respectivamente; comparten borde derecho y sus líneas de base coinciden con las etiquetas originales.

## Edición y descarga

La selección Branding/Diseño/Diseño de colección determina el PDF utilizado. Se editan datos en el formulario del CRM, incluida validez libre opcional y los cinco renglones del cronograma de branding. La vista PDF muestra el archivo real dentro del navegador y permite abrirlo en otra pestaña.

Colección pregunta primero si hubo asesoría previa y cuánto se cobró. Ese importe se resta una sola vez del subtotal, independientemente de guardar o editar repetidamente el presupuesto; no se registra como un cobro del nuevo trabajo. Si se indica que no hubo asesoría, el PDF final y el editable muestran únicamente el total en negro, sin subtotal ni descuento por asesoría. El total sube al primer renglón y el recuadro se compacta, sin dejar una fila vacía. La cantidad de tipologías se ingresa manualmente (1 a 9999) y completa el espacio de la propuesta. Los servicios aceptan precios unitarios negativos con cantidades positivas en las tres plantillas. El subtotal suma los servicios con su signo y el total resta además la asesoría, cuando corresponde. El total no puede ser negativo.

- **PDF final:** campos aplanados, listo para enviar. No depende de imprimir el HTML del navegador.
- **PDF editable:** formulario AcroForm con cliente, fecha, validez, referencia, servicios, precios, cantidades, cronograma y total según la plantilla. Se puede rellenar con un lector compatible y guardar el archivo. No es un archivo de edición gráfica de Illustrator. Los textos y gráficos originales permanecen como contenido de la plantilla.

El cálculo automático de totales se hace en el CRM. El PDF editable no ejecuta JavaScript: si se cambian importes o cantidades dentro del archivo, se debe actualizar también el total manualmente. Los cambios hechos en el PDF descargado no se sincronizan al CRM. Conviene editar el presupuesto dentro de la app y volver a descargarlo para conservar consistencia.

## Contenido que excede los espacios originales

Diseño y Diseño de colección mantienen una sola hoja. Diseño conserva la tabla original para hasta dos servicios; con tres o más adapta las filas y la tipografía al espacio disponible. Las condiciones y observaciones se acomodan en su zona inferior. Colección conserva el alcance del PDF original y omite el resumen automático de servicios; solo imprime las notas si se ingresaron. La cantidad de tipologías se muestra sin subrayado y alineada con la frase original. Si un texto o la cantidad de servicios no cabe con tamaño legible, se devuelve un error 422 que pide acortar descripciones o agrupar servicios: no se recorta información ni se agregan páginas.

Las variantes `design-grid.pdf`, `design-terms.pdf`, `design-grid-terms.pdf`, `collection-base.pdf`, `collection-terms.pdf` y sus variantes `collection-no-consultation-base.pdf` / `collection-no-consultation-terms.pdf` preparan únicamente la tabla o los textos que se van a reemplazar. Se generan con `python scripts/prepare-quote-templates.py` (requiere PyMuPDF solo en desarrollo). El script retira las invocaciones de los Form XObjects correspondientes y reemplaza los guiones bajos de las tipologías por su avance tipográfico exacto. Conserva los demás gráficos, transparencias y fuentes de Illustrator; los tres originales permanecen intactos.

En branding, las doce páginas se mantienen. La primera hoja no imprime el nombre del cliente ni contiene un campo editable para él; el cliente sigue vinculado al presupuesto en el CRM. Se completa el cronograma en la página 9, el monto del proyecto y el detalle de servicios en el espacio libre de la página de adicionales. El importe de «valor del proyecto» usa Coolvetica Regular con tracking −40, alineado a la derecha y con la línea de base de la etiqueta original. Los demás datos completados continúan en Poppins. La fuente completa y su procedencia están documentadas en [Coolvetica-SOURCE.md](Coolvetica-SOURCE.md). Las condiciones generales originales se conservan. Cuando se cargan condiciones particulares distintas de las predeterminadas, se agrega un anexo que indica que prevalecen sobre las generales en los puntos indicados. Observaciones y cronograma libre también se incluyen en anexos. Los bocetos vinculados se descargan por separado desde la misma vista; no se incrustan como nuevas páginas del presupuesto.

## Validación

Se verificaron dimensiones y cantidad de páginas; campos con acentos y ñ; guardado y relectura de valores del PDF rellenable; descarga final sin campos; anexos extensos de Branding; Diseño con tres a seis servicios en una hoja; pregunta previa de asesoría, descuento aplicado una vez, precios negativos, centavos y descarga de colección desde Chromium. Las pruebas de integración también se ejecutaron con PostgreSQL embebido. La comparación rasterizada de las variantes preparadas con los originales no mostró píxeles distintos fuera de las zonas modificadas. También se comprobó visualmente el PDF real.

El nombre del proyecto se omitió del formulario de presupuestos y de ambas salidas PDF. Su espacio en las plantillas queda vacío; los demás elementos mantienen su posición. Los nombres internos de registros existentes se conservan para no alterar listados ni trabajos vinculados. Los presupuestos nuevos usan su referencia como identificación interna.
