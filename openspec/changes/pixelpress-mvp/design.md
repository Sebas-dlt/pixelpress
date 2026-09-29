# Design

## Context

- El diseño de Lovable (pdf-word-pal.lovable.app) fija la identidad visual
  (tokens OKLCH, Baloo 2 + Nunito, copy de privacidad) y promete "0 archivos
  enviados / procesado en tu navegador". Esa promesa es la decisión de
  arquitectura, no un eslogan.
- Vercel limita payloads de funciones a 4.5 MB y no ofrece estado entre
  invocaciones; cualquier backend obligaría a Blob efímero o streaming
  no documentado, y a reescribir el copy de privacidad.
- Requisito explícito del usuario: **cero servidores, privacidad, sin sacrificar
  fidelidad**. Licencia AGPL-3.0 aceptada; plan Vercel Hobby.
- OpenSpec es el proceso de decisión exigido por el usuario.

## Goals / Non-Goals

**Goals:**
- Word→PDF con fidelidad equivalente a LibreOffice nativo (mismo motor).
- PDF→Word fiel para texto: párrafos, tamaños, negritas/cursivas, alineación,
  tablas e imágenes; editable de verdad (no captura).
- Cero peticiones de red que contengan datos del archivo.
- Experiencia completa: drag&down, progreso, descarga, errores claros.

**Non-Goals:**
- OCR para PDFs escaneados (se detecta y se avisa; fuera de alcance v1).
- Otras herramientas PDF (comprimir, fusionar, dividir), cuentas, API pública.
- Edición de documentos dentro de la web.

## Decisions

1. **Arquitectura 100% cliente (no servidor).** Alternativa considerada:
   funciones Python en Vercel con LibreOffice + pdf2docx (máxima fidelidad
   PDF→Word) descartada porque rompe la promesa de privacidad, añade límites de
   payload/tiempo y coste. Se acepta el trabajo extra de motor PDF→Word propio a
   cambio de privacidad literal y cero operación.
2. **Word→PDF = LibreOffice WASM (`@matbee/libreoffice-converter`, MPL-2.0).**
   Alternativas descartadas: `docx-preview`+print (UX semimanual, menor
   fidelidad), `mammoth`+jsPDF (rasteriza, pierde texto seleccionable),
   `docx-wasm` de Native Documents (comercial, sin API keys cliente).
3. **PDF→Word = motor propio `mupdf` + `docx` (decidido por spike).**
   Resultados: (a) `pdf→docx` de LibreOffice WASM falla
   (`CONVERSION_FAILED: Failed to save document`) — descartado;
   (b) motor propio funciona: `src/engine/pdfToDocx.ts` sobre
   `mupdf.toStructuredText` (texto+vectores+imágenes) + constructor `docx`.
   Calidad medida con fixture de ida y vuelta (PDF→DOCX→PDF vs original,
   umbral de píxel ≥16): **1.00% página 1 / 0.24% página 2**; texto idéntico
   843/843 caracteres (pdftotext). Elementos validados: wrap de párrafos,
   tamaños/fuentes/negrita/cursiva/subrayado/color, listas con tab, tabla con
   bordes+relleno, imagen pixel-exacta (delta 0,0), encabezado/pie con
   sangrado correcto, salto de página. `pdfjs-descartado` (sin engines de
   layout; mupdf ya aporta order/estilos). Precedente: `pdfto-tools`
   (PDFium + LO WASM en navegador).
   Gotchas registradas: `spacing.line` EXACT va en twips (pt×20); LO reparte
   el glifo 80/20 en la caja de línea; márgenes derivados con snap a rejilla
   (inferior con floor para no desbordar la última línea).
4. **Stack UI: Vite + React + TypeScript + Tailwind.** Mismo stack que genera
   Lovable (reconstrucción fiel del diseño) y estático puro para Vercel.
5. **Licencia AGPL-3.0** para el código propio; dependencias MPL-2.0,
   Apache-2.0, MIT y AGPL compatibles. El WASM de LibreOffice no se modifica
   (MPL no contagia; se invoca como proceso/worker).
6. **Motor lazy + caché**: el WASM (~254 MB) se descarga solo al primer uso,
   con barra de progreso, y queda cacheado (HTTP + OPFS según soporte).
   Verificar en spike si existe descarga parcial del mínimo necesario.
7. **Workers + SharedArrayBuffer**: conversión en Web Worker para no bloquear la
   UI; requiere headers `Cross-Origin-Opener-Policy` y
   `Cross-Origin-Embedder-Policy` en `vercel.json`.
8. **Spike A2 (navegador) — resultado:** `crossOriginIsolated: true` con esos
   headers en `vite preview` y en Vercel. Peso real descargado al primer uso de
   Word→PDF: `soffice.wasm` 147 MB + `soffice.data` 99.7 MB + `soffice.js`
   0.4 MB (≈247 MB) más `mupdf` 10.4 MB y el bundle propio; se sirven desde
   `/wasm` y `/dist` (symlink a `node_modules` desreferenciado en el build).
   Tiempos medidos en local: init 1.6–4.5 s, conversión DOCX→PDF 1.2–1.4 s,
   PDF→Word ≈2 s. PDF→Word no descarga LibreOffice (lazy import), así que ese
   flujo pesa ~10 MB.
9. **Watchdog de conversión + verificación de salida (mitiga un bloqueo aguas
   arriba).** LibreOffice WASM se bloquea de forma intermitente en una espera
   pura (futex, 0 CPU, 0 I/O) durante el escaneo de fuentes — observado tanto en
   `initialize()` (la app quedaba colgada en "Initializing LibreOfficeKit..."
   sin fin) como en `documentLoad`/guardado — o, en el mismo fenómeno, guarda un
   PDF sin fuentes (páginas en blanco con texto perdido). Se descartó como
   causal: red, CPU, swap, conteo de fuentes, caché fontconfig, `rejectfont`,
   `SAL_LOG`, `MAX_CONCURRENCY`, servidor de desarrollo (ocurre igual en
   `preview`). No reproducible sin el paquete matbee y no corregible por
   configuración; tasa medida ~0.5 por sesión fría en navegador, 0 en
   conversiones posteriores (~150 ms). Mitigación en `src/convert.ts`:
   presupuestos por intento — `init 20 s` y conversión `[20 s, 60 s, 60 s]` —,
   corte con `worker.terminate()` y worker nuevo entre intentos (sin esperar a
   que `destroy()` responda), y validación de que el PDF lleva `/BaseFont` (y de
   que el DOCX de entrada tenía `<w:t>`) antes de entregar: si no, se reintenta
   en vez de descargar un archivo vacío. `scripts/guardcheck.ts` cubre esa
   lógica y el rechazo de entrada (extensión, tamaño, PDF escaneado o con
   contraseña); `scripts/fidelity.ts` cubre la ida y vuelta (PDF→DOCX con
   estructura y DOCX→PDF con texto 118/118).
10. **Techo de Vercel Hobby: 100 GB/mes de Fast Data Transfer** ⇒ ≈400 primeras
    visitas que usen Word→PDF (≈250 MB por visita) antes de agotar el mes.
    `/assets` va con caché inmutable (nombres hasheados) y `/wasm`+`/dist`
    con revalidación diaria (ETag ⇒ 304 barato), para no re-descargar 247 MB
    en cada visita. Escalada documentada: servir `/wasm` desde otro origin
    (R2/jsDelivr) exigiendo `Cross-Origin-Resource-Policy: cross-origin` en ese
    origin por el COEP.

## Risks / Trade-offs

- **Descarga inicial pesada (~247 MB)**: mitigado con lazy-load (solo en
  Word→PDF), progreso y caché diaria con ETag; techo de ancho de banda de
  Vercel Hobby documentado en la decisión 10.
- **Fidelidad PDF→Word limitada en layouts complejos** (cajas flotantes,
  columnas finas): acotado en copy y medido con fixtures; es el riesgo aceptado
  a cambio de cero servidores.
- **Memoria en móvil con archivos grandes**: límite de tamaño explícito en UI
  y manejo de errores de OOM.
- **Madurez del build WASM de LO** (paquete joven): spike antes de invertir en
  UI; fallback documentado = engine propio DOCX→PDF no existe, se reevaluaría
  servidor efímero.
- **COOP/COEP** rompe recursos cross-origin no etiquetados: el sitio no carga
  terceros (salvo Google Fonts, verificar con `crossorigin`).
