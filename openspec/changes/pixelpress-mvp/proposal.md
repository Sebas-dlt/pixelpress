# Proposal

## Why

Las herramientas online de conversión PDF (iLovePDF y similares) exigen subir el
documento a servidores de terceros donde se almacenan temporalmente (2 horas en
el caso de iLovePDF). Usuarios con contratos, historiales o documentos
financieros no tienen una alternativa gratuita con buena fidelidad que no
exponga sus archivos. Los motores de conversión hoy son lo suficientemente
maduros para correr 100% en el navegador (LibreOffice compilado a WASM), por lo
que se puede ofrecer la promesa más fuerte posible: **el archivo nunca sale del
dispositivo, ni siquiera un instante**.

## What Changes

- Producto web estático **PixelPress** (sin backend, sin funciones serverless):
  landing de confianza + convertidor con dos herramientas, PDF→Word y Word→PDF.
- Conversión Word→PDF con **LibreOffice WASM** (`@matbee/libreoffice-converter`),
  el mismo motor de alta fidelidad que un despliegue server-side.
- Conversión PDF→Word con el mejor motor disponible en navegador, elegido por
  resultados empíricos: `pdf→docx` de LibreOffice WASM vs motor propio
  (`mupdf`/`pdfjs-dist` + `docx`).
- Descarga lazy del motor WASM (~254 MB, cacheado) con UI de progreso.
- Repositorio público AGPL-3.0 desplegado en Vercel como sitio estático.

## Capabilities

### New Capabilities
- `conversion`: convertir PDF→DOCX y DOCX→PDF en el navegador con fidelidad
  verificable, límites claros y manejo de PDFs escaneados.
- `privacy`: garantía de que ningún archivo del usuario transita la red ni se
  persiste, respaldada por arquitectura sin servidor y código abierto.
- `ui`: interfaz de conversión (drag&drop, progreso del motor, descarga,
  errores y avisos) reconstruida sobre el diseño de Lovable.

### Modified Capabilities

## Impact

- Repo nuevo `pixelpress` (AGPL-3.0), sin servicios externos ni bases de datos.
- Dependencias: `@matbee/libreoffice-converter` (MPL-2.0), `mupdf` (AGPL) o
  `pdfjs-dist` (Apache-2.0), `docx` (MIT) — todas compatibles con AGPL-3.0.
- Vercel: solo assets estáticos; requiere headers COOP/COEP para
  SharedArrayBuffer y caché inmutable para los assets WASM.
- Coste operativo: $0 (sin funciones ni almacenamiento).
