import { readFileSync, writeFileSync } from "node:fs";
import { pdfToDocx, ScannedPdfError, ProtectedPdfError } from "../src/engine/pdfToDocx.ts";

const pdf = new Uint8Array(readFileSync("spikes/out/fixture.pdf"));
const t0 = Date.now();
try {
  const out = await pdfToDocx(pdf);
  writeFileSync("spikes/out/fixture-back.docx", out);
  console.log(`OK ${out.length} bytes en ${Date.now() - t0}ms`);
} catch (e) {
  if (e instanceof ScannedPdfError) console.log("SCANNED:", e.message);
  else if (e instanceof ProtectedPdfError) console.log("PROTECTED:", e.message);
  else throw e;
}
process.exit(0);
