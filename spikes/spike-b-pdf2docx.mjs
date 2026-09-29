import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { convertDocument } from "@matbee/libreoffice-converter";

const WASM_DIR = fileURLToPath(new URL("../node_modules/@matbee/libreoffice-converter/wasm/", import.meta.url));
const input = process.argv[2] ?? "spikes/out/fixture.pdf";
const output = process.argv[3] ?? "spikes/out/fixture-back.docx";

const bytes = readFileSync(input);
console.log(`Entrada: ${input} (${bytes.length} bytes)`);
const t0 = Date.now();
try {
  const result = await convertDocument(
    bytes,
    { outputFormat: "docx", filename: input.split("/").pop() },
    { wasmPath: WASM_DIR },
  );
  writeFileSync(output, result.data);
  console.log(`OK -> ${output} (${result.data.length} bytes) en ${Date.now() - t0} ms`);
} catch (e) {
  console.error(`FALLO en ${Date.now() - t0} ms:`, e?.code ?? "", String(e?.message ?? e).slice(0, 500));
  process.exit(1);
}
