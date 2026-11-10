# Plantillas de presupuesto BOGA

`design.pdf`, `branding.pdf` y `collection.pdf` son copias byte por byte de los PDF aportados por la usuaria:

- PRESUPUESTO EDITABLE.pdf: A4 vertical, 595.276 × 841.89 pt, una página.
- PRESUPUESTO BRANDING.pdf: A4 apaisado, 841.89 × 595.276 pt, doce páginas.
- Propuesta Colección.pdf: A4 apaisado, 841.89 × 595.276 pt, diez páginas. Reemplaza la propuesta vertical anterior de colección.

`quote-pdf.js` copia sus páginas y agrega campos transparentes, sin reconstruir ni rasterizar el diseño. Se conservan márgenes, encabezados, gráficos, marcas de agua y fuentes originales. Los datos nuevos usan Poppins Regular; el importe de Branding y los importes de Colección usan Coolvetica Regular. Todos los campos completados usan tracking −40 (−0,04 em), incluido en la medición para conservar la alineación. Las fuentes completas están incrustadas para permitir edición posterior. Ver Poppins-LICENSE.txt y [Coolvetica-SOURCE.md](Coolvetica-SOURCE.md).

## Diseño de colección

La propuesta conserva exactamente sus diez páginas, sin anexos ni contenido adicional:

- **Portada:** nombre del cliente, fecha y validez, en Poppins y el verde del archivo, según lo confirmado por la usuaria.
- **Página 8:** cinco renglones del cronograma (Investigación, Diseño, Devolución, Entrega y Revisión final) y valor del proyecto. Los importes usan Coolvetica Regular y el ARS original; no se agrega un signo monetario adicional.
- **Con asesoría:** subtotal, descuento por asesoría y total. El subtotal y el descuento usan la tinta clara del original; el total conserva su verde. Los importes comparten borde derecho y las líneas de base de los ejemplos originales.
- **Sin asesoría:** solo el total, en el verde del PDF elegido expresamente por la usuaria. Se omiten subtotal, descuento y los indicadores ARS de esas filas.

El CRM sigue preguntando si hubo asesoría y cuánto se cobró. Ese importe se descuenta una sola vez del subtotal, incluso al editar repetidamente; no se registra como cobro del nuevo presupuesto. Los servicios admiten precios negativos con cantidades positivas. El total neto no puede ser negativo y determina el límite de los cobros.

La referencia, la cantidad de tipologías acordadas, el detalle de servicios, las condiciones, los adicionales y las notas se conservan internamente en el CRM. No se imprimen ni sustituyen textos de la propuesta nueva. No se recupera la frase de tipologías de la plantilla anterior. Las condiciones y la página de contacto del nuevo documento permanecen como en el original.

`collection-base.pdf` y `collection-no-consultation-base.pdf` retiran únicamente los tres importes de ejemplo de la página 8. En la variante sin asesoría también se retiran sus etiquetas y monedas sobrantes. El script conserva los operadores de posición para mantener las etiquetas restantes y el resto del diseño intactos. Las tintas de los campos se expresan en el CMYK original para conservar la apariencia sobre el fondo oscuro.

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

Ejecutar `python scripts/prepare-quote-templates.py` requiere PyMuPDF solo en desarrollo. Produce las tres variantes de Diseño (`design-grid`, `design-terms`, `design-grid-terms`) y las dos de Colección, sin modificar los originales ni requerir herramientas Python en producción.

Las pruebas verifican descargas desde Chromium, asesoría aplicada una sola vez, precios negativos y centavos; diez páginas de colección con importes y cronograma en la página 8 y datos en portada; campos editables con ambas fuentes; salida final aplanada; ausencia de importes de ejemplo y contenido interno; conservación de Diseño en una hoja y Branding con sus doce páginas y anexos. La comparación rasterizada comprueba que los gráficos y las otras páginas no cambian fuera de las zonas de datos.
