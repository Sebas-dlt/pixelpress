import { readFileSync } from "node:fs";
import { LibreOfficeConverter } from "@matbee/libreoffice-converter";

const WASM_DIR = "/home/sebas/pixelpress/node_modules/@matbee/libreoffice-converter/wasm/";
const t0 = Date.now();
const bytes = readFileSync("/home/sebas/pixelpress/spikes/out/fixture.docx");
import wasmLoader from "/home/sebas/pixelpress/node_modules/@matbee/libreoffice-converter/wasm/loader.cjs";
const conv = new LibreOfficeConverter({ wasmLoader, wasmPath: WASM_DIR, verbose: false });
const tInit = Date.now();
await conv.initialize();
const initMs = Date.now() - tInit;
const tConv = Date.now();
const r = await conv.convert(bytes, { outputFormat: "pdf", filename: "fixture.docx" });
const convMs = Date.now() - tConv;
process.stdout.write(`init=${initMs}ms convert=${convMs}ms bytes=${r.data.length}\n`);
process.exit(0);
