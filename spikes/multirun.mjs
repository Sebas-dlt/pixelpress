import { readFileSync } from "node:fs";
import { LibreOfficeConverter } from "@matbee/libreoffice-converter";
import wasmLoader from "/home/sebas/pixelpress/node_modules/@matbee/libreoffice-converter/wasm/loader.cjs";

const WASM_DIR = "/home/sebas/pixelpress/node_modules/@matbee/libreoffice-converter/wasm/";
const bytes = readFileSync("/home/sebas/pixelpress/spikes/out/fixture.docx");
const conv = new LibreOfficeConverter({ wasmLoader, wasmPath: WASM_DIR, verbose: false });
await conv.initialize();
const out = [];
for (let i = 0; i < 4; i++) {
  const t = Date.now();
  const r = await conv.convert(bytes, { outputFormat: "pdf", filename: "fixture.docx" });
  out.push(`${Date.now() - t}ms/${r.data.length}B`);
}
process.stdout.write(out.join(" ") + "\n");
process.exit(0);
