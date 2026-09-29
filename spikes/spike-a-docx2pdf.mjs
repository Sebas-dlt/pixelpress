import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { convertDocument } from "@matbee/libreoffice-converter";

const WASM_DIR = fileURLToPath(
  new URL("../node_modules/@matbee/libreoffice-converter/wasm/", import.meta.url),
);

const input = process.argv[2] ?? "spikes/out/fixture.docx";
const output = process.argv[3] ?? "spikes/out/fixture.pdf";

const bytes = readFileSync(input);
console.log(`Entrada: ${input} (${bytes.length} bytes)`);

const t0 = Date.now();
const result = await convertDocument(
  bytes,
  {
    outputFormat: "pdf",
    filename: input.split("/").pop(),
  },
  { wasmPath: WASM_DIR },
);
const ms = Date.now() - t0;

writeFileSync(output, result.data);
console.log(
  `OK -> ${output} (${result.data.length} bytes) en ${ms} ms [mime=${result.mimeType}]`,
);

process.exit(0);
