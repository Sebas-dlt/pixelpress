# Tasks

## 1. Spikes de riesgo (decisión de motor)

- [x] 1.1 Scaffold Vite + React + TS + Tailwind en la raíz del repo
- [x] 1.2 Fixture DOCX complejo generado con `docx` (títulos, negritas, cursivas, listas, tablas, imágenes, tamaños variados, encabezados)
- [x] 1.3 Spike A: DOCX→PDF con `@matbee/libreoffice-converter` en Node; verificar PDF resultante (texto + render visual)
- [x] 1.4 Spike A2: mismo proceso en navegador (worker, COOP/COEP, peso real descargado, tiempos)
- [x] 1.5 Spike B: PDF→DOCX vía LO WASM (`pdf` como entrada) y, si falla, vía `mupdf`/`pdfjs-dist` + `docx`
- [x] 1.6 Comparar resultados de ida y vuelta y elegir motor PDF→Word (registrar en design.md)

## 2. OpenSpec

- [x] 2.1 Artefactos proposal/design/tasks/specs del change `pixelpress-mvp`
- [x] 2.2 `openspec validate pixelpress-mvp` sin errores
- [x] 2.3 Actualizar design.md con resultados de spikes (motor elegido)

## 3. UI PixelPress

- [x] 3.1 Reconstruir landing (nav, hero, sección convertidor, 3 features, stats, FAQ, footer) con tokens del diseño (OKLCH, Baloo 2 + Nunito)
- [x] 3.2 Dropzone: drag&drop + selector de archivo, detección de tipo (PDF/DOCX)
- [x] 3.3 Estados: carga del motor con progreso, convirtiendo, éxito con descarga, error, aviso de PDF escaneado, aviso de tamaño máximo
- [x] 3.4 Responsive + accesible (contraste, foco, ARIA en dropzone)

## 4. Integración de motores

- [x] 4.1 Módulo de conversión en Web Worker (DOCX→PDF y PDF→DOCX)
- [x] 4.2 Lazy-load del WASM con progreso + caché de la descarga
- [x] 4.3 Validación de entrada: MIME/extensión, tamaño máximo, PDF sin capa de texto
- [x] 4.4 Limpieza de memoria (blobs revocados, buffers liberados)

## 5. Suite de fidelidad

- [x] 5.1 Fixtures de prueba + test automatizado: DOCX→PDF→texto coincide; PDF→DOCX→reapertura con estructura esperada
- [ ] 5.2 Verificación visual manual de renders (PNG por página) y aprobación
- [x] 5.3 Tests unitarios de validación de entrada

## 6. Repositorio y despliegue

- [x] 6.1 `git init`, LICENSE AGPL-3.0, README (qué hace, privacidad, límites)
- [x] 6.2 Push a GitHub (repo público)
- [x] 6.3 `vercel.json`: headers COOP/COEP, caché inmutable de `/assets` y WASM
- [ ] 6.4 Deploy en Vercel Hobby + smoke test E2E en el dominio
