import { readFileSync } from "node:fs";
import wasmLoader from "../node_modules/@matbee/libreoffice-converter/wasm/loader.cjs";
import { LibreOfficeConverter } from "@matbee/libreoffice-converter";
import { pdfToDocx } from "../src/engine/pdfToDocx.ts";
import { pdfHasText, docxEntry, docxEntryNames } from "../src/convert.ts";

const FIXTURE = new URL("../spikes/out/fixture.docx", import.meta.url);
const REF_PDF = new URL("../spikes/out/fixture.pdf", import.meta.url);

function docxText(xml: string): string[] {
  // runs inside a paragraph are adjacent (styled fragments), so join them without
  // separators and only separate paragraphs
  const paras = xml.match(/<w:p[\s>][\s\S]*?<\/w:p>/g) ?? [];
  return paras
    .map((p) =>
      (p.match(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g) ?? [])
        .map((m) => m.replace(/<[^>]+>/g, ""))
        .join(""),
    )
    .join(" ")
    .split(/\s+/)
    .filter(Boolean);
}

// mupdf ships a Node build; same API the browser engine uses.
const mupdf = await import("mupdf");
function pdfText(pdf: Uint8Array): string[] {
  const doc = mupdf.Document.openDocument(pdf) as mupdf.Document;
  const full = [...Array(doc.countPages()).keys()]
    .map((i) => doc.loadPage(i).toStructuredText().asText())
    .join(" ");
  doc.destroy();
  return full.split(/\s+/).filter(Boolean);
}

const fails: string[] = [];
const ok = (cond: boolean, label: string) => {
  console.log(`${cond ? "ok  " : "FAIL"} ${label}`);
  if (!cond) fails.push(label);
};

// --- 1. PDF -> DOCX: estructura esperada al reabrir ---
const srcDocx = new Uint8Array(readFileSync(FIXTURE));
const srcXml = (await docxEntry(srcDocx, "word/document.xml")) ?? "";
const outDocx = await pdfToDocx(new Uint8Array(readFileSync(REF_PDF)));
const outXml = (await docxEntry(outDocx, "word/document.xml")) ?? "";
const names = docxEntryNames(outDocx);

ok(outDocx[0] === 0x50 && outDocx[1] === 0x4b, "pdf->docx produce un zip");
ok(outXml.includes("<w:b/>"), "mantiene negritas");
ok(outXml.includes("<w:i/>"), "mantiene cursivas");
ok(outXml.includes("<w:tbl>"), "mantiene la tabla");
ok(names.some((n) => n.startsWith("word/media/")), "mantiene la imagen");
ok(docxText(srcXml).length > 100, "el DOCX de entrada tiene texto");

// --- 2. DOCX -> PDF -> texto coincide ---
const WASM = new URL("../node_modules/@matbee/libreoffice-converter/wasm/", import.meta.url).pathname;
const lo = new LibreOfficeConverter({ wasmLoader, wasmPath: WASM, verbose: false });
await lo.initialize();
const t0 = Date.now();
const pdf = await lo.convert(srcDocx, { outputFormat: "pdf", filename: "fixture.docx" });
console.log(`     docx->pdf en ${Date.now() - t0}ms (${pdf.data.length}B)`);
ok(pdfHasText(pdf.data), "el PDF exportado lleva fuentes (no sale en blanco)");

const want = docxText(srcXml);
const got = pdfText(pdf.data);
ok(got.length > 100, `el PDF extrae texto (${got.length} tokens)`);
const missing = want.filter((w) => !got.includes(w));
ok(
  want.length > 0 && missing.length / want.length < 0.05,
  `texto conservado: ${want.length - missing.length}/${want.length} tokens` +
    (missing.length ? ` (faltan: ${missing.slice(0, 5).join(" ")})` : ""),
);

if (fails.length) {
  console.error(`\n${fails.length} comprobaciones fallidas`);
  process.exit(1);
}
process.exit(0);
