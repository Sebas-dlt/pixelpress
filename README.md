# PixelPress

Convierte **PDF ⇄ Word sin subir nada**: todo el procesado ocurre en tu navegador.

- **PDF → Word** con motor propio (`mupdf` + `docx`): párrafos, tamaños,
  negritas/cursivas, alineación, listas, tablas, imágenes y encabezados.
- **Word → PDF** con LibreOffice compilado a WebAssembly
  (`@matbee/libreoffice-converter`), el mismo motor que la versión de escritorio.
- **Cero backend**: no hay API, ni base de datos, ni subidas. Tu archivo no sale
  de tu equipo, ni siquiera un momento.

## Límites

- Hasta **50 MB** por archivo (`.pdf` o `.docx`).
- PDF escaneados (sin capa de texto): se detectan y se avisan; no hay OCR en v1.
- Word→PDF descarga **~247 MB** la primera vez (LibreOffice WASM) y después
  queda cacheado; conversiones siguientes tardan ~0,2 s.
- LibreOffice WASM se bloquea de forma intermitente en la **primera** conversión
  (espera aguas arriba, sin CPU ni E/S). La app lo corta, reinicia el worker y
  reintenta (hasta 3 intentos), y valida que el PDF salga con texto antes de
  entregártelo.
- Vercel Hobby: 100 GB/mes ⇒ **~400 primeras visitas** de Word→PDF al mes.

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # guardas: salida no vacía + rechazos de entrada
npm run fidelity # ida y vuelta: PDF->DOCX estructura, DOCX->PDF texto
npm run build    # tsc + vite build → dist/
```

## Verificación

- `npm test` (`scripts/guardcheck.ts`): comprueba la validación de salida que
  evita entregar un PDF vacío.
- `spikes/`: reproducciones de los riesgos evaluados (fidelidad de ida y vuelta,
  bloqueo de LibreOffice WASM, fixture DOCX complejo).
- La decisión de arquitectura y los resultados de los spikes están en
  `openspec/changes/pixelpress-mvp/design.md`.

## Despliegue

Estático (`dist/`), configurado en `vercel.json`: headers COOP/COEP (necesarios
para `SharedArrayBuffer`), caché inmutable en `/assets` y revalidación diaria en
`/wasm` + `/dist`.

## Licencia

[AGPL-3.0-or-later](LICENSE). Dependencias: MPL-2.0 (`@matbee/libreoffice-converter`),
AGPL-3.0 (`mupdf`), MIT (`docx`, React, Vite) y Apache-2.0 (generadas por Vite).
