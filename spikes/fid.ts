import { readFileSync, writeFileSync } from "node:fs";
import { pdfToDocx } from "../src/engine/pdfToDocx.ts";
import wasmLoader from "../node_modules/@matbee/libreoffice-converter/wasm/loader.cjs";
import { LibreOfficeConverter } from "../node_modules/@matbee/libreoffice-converter/dist/index.js";

const pdf = new Uint8Array(readFileSync("/tmp/opencode/fid/real.pdf"));
const t0 = Date.now();
const docx = await pdfToDocx(pdf);
writeFileSync("/tmp/opencode/fid/real-out.docx", docx);
console.log(`pdf->docx: ${docx.length}B en ${Date.now() - t0}ms`);
const lo = new LibreOfficeConverter({ wasmLoader, wasmPath: new URL("../node_modules/@matbee/libreoffice-converter/wasm/", import.meta.url).pathname, verbose: false });
await lo.initialize();
const out = await lo.convert(docx, { outputFormat: "pdf", filename: "x.docx" });
writeFileSync("/tmp/opencode/fid/real-rt.pdf", out.data);
console.log(`docx->pdf: ${out.data.length}B`);
process.exit(0);
