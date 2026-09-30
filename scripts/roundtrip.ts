// pdf -> docx (nuestro motor) -> pdf (LibreOffice) para cada PDF de un directorio.
// Uso: node scripts/roundtrip.ts <dir_entrada> <dir_salida>
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import wasmLoader from "../node_modules/@matbee/libreoffice-converter/wasm/loader.cjs";
import { LibreOfficeConverter } from "@matbee/libreoffice-converter";
import { pdfToDocx } from "../src/engine/pdfToDocx.ts";

const [inDir, outDir] = process.argv.slice(2);
if (!inDir || !outDir) {
  console.error("uso: node scripts/roundtrip.ts <dir_entrada> <dir_salida>");
  process.exit(2);
}
mkdirSync(outDir, { recursive: true });
const lo = new LibreOfficeConverter({
  wasmLoader,
  wasmPath: new URL("../node_modules/@matbee/libreoffice-converter/wasm/", import.meta.url).pathname,
  verbose: false,
});
await lo.initialize();

let bad = 0;
for (const f of readdirSync(inDir).filter((n) => n.endsWith(".pdf")).sort()) {
  const t0 = Date.now();
  try {
    const src = new Uint8Array(readFileSync(`${inDir}/${f}`));
    const docx = await pdfToDocx(src);
    const pdf = await lo.convert(docx, { outputFormat: "pdf", filename: f.replace(/\.pdf$/, ".docx") });
    writeFileSync(`${outDir}/${f}`, Buffer.from(pdf.data));
    console.log(`ok   ${f}: docx ${docx.length}B -> pdf ${pdf.data.length}B (${Date.now() - t0}ms)`);
  } catch (e) {
    bad++;
    console.log(`FAIL ${f}: ${(e as Error).message}`);
  }
}
process.exit(bad ? 1 : 0);
