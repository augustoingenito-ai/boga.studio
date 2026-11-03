# Plantillas de presupuesto BOGA

`design.pdf` y `branding.pdf` son copias byte por byte de los PDF aportados por la usuaria:

- PRESUPUESTO EDITABLE.pdf: A4 vertical, 595.276 × 841.89 pt, una página.
- PRESUPUESTO BRANDING.pdf: A4 apaisado, 841.89 × 595.276 pt, doce páginas.

`quote-pdf.js` copia sus páginas y agrega campos transparentes, sin reconstruir ni rasterizar el diseño. Se conservan márgenes, encabezados, tablas, marcas de agua, gráficos y las fuentes originales incrustadas (incluidas Goudy, Coolvetica y las marcas). Los datos nuevos usan Poppins Regular completo, descargado del repositorio oficial google/fonts, con licencia en Poppins-LICENSE.txt. Los colores de los datos se toman de las páginas correspondientes del original.

## Edición y descarga

La selección Branding/Diseño determina el PDF utilizado. Se editan datos en el formulario del CRM, incluida validez libre opcional y los cinco renglones del cronograma de branding. La vista PDF muestra el archivo real dentro del navegador y permite abrirlo en otra pestaña.

- **PDF final:** campos aplanados, listo para enviar. No depende de imprimir el HTML del navegador.
- **PDF editable:** formulario AcroForm con cliente, fecha, validez, referencia, servicios, precios, cantidades, cronograma y total según la plantilla. Se puede rellenar con un lector compatible y guardar el archivo. No es un archivo de edición gráfica de Illustrator. Los textos y gráficos originales permanecen como contenido de la plantilla.

El cálculo automático de totales se hace en el CRM. El PDF editable no ejecuta JavaScript: si se cambian importes o cantidades dentro del archivo, se debe actualizar también el total manualmente. Los cambios hechos en el PDF descargado no se sincronizan al CRM. Conviene editar el presupuesto dentro de la app y volver a descargarlo para conservar consistencia.

## Contenido que excede los espacios originales

Diseño conserva las dos filas del original; presupuestos con más filas generan páginas de continuación con la misma plantilla. Solo la última muestra el total general. Si un texto no cabe con tamaño legible se referencia un anexo que conserva el texto completo.

En branding, las doce páginas se mantienen y se completa el cronograma en la página 9, el monto del proyecto y el detalle de servicios en el espacio libre de la página de adicionales. Las condiciones generales originales se conservan. Cuando se cargan condiciones particulares distintas de las predeterminadas, se agrega un anexo que indica que prevalecen sobre las generales en los puntos indicados. Observaciones y cronograma libre también se incluyen en anexos. Los bocetos vinculados se descargan por separado desde la misma vista; no se incrustan como nuevas páginas del presupuesto.

## Validación

Se verificaron dimensiones y cantidad de páginas; campos con acentos y ñ; guardado y relectura de valores del PDF rellenable; descarga final sin campos; anexos extensos; cuatro servicios en páginas de continuación y descarga desde Chromium. La comparación rasterizada con los originales no mostró píxeles distintos fuera de los rectángulos de datos nuevos. También se comprobó visualmente el PDF real en el visor del CRM.

El nombre del proyecto se omitió del formulario de presupuestos y de ambas salidas PDF. Su espacio en las plantillas queda vacío; los demás elementos mantienen su posición. Los nombres internos de registros existentes se conservan para no alterar listados ni trabajos vinculados. Los presupuestos nuevos usan su referencia como identificación interna.
