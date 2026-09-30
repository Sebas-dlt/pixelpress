import { readFileSync } from "node:fs";
import { docxEntryNames } from "../src/convert.ts";
const mupdf = await import("mupdf");
const pdf = new Uint8Array(readFileSync("/tmp/opencode/fid/real.pdf"));
const doc = mupdf.Document.openDocument(pdf) as mupdf.Document;
for (let i = 0; i < doc.countPages(); i++) {
  const page = doc.loadPage(i);
  const st = page.toStructuredText("preserve-whitespace");
  const imgs = JSON.parse(JSON.stringify((page as any).getImages ? (page as any).getImages() : []));
  const draws = JSON.parse((page as any).getDrawings ? JSON.stringify((page as any).getDrawings()) : "[]");
  console.log(`page ${i+1}: images=${imgs.length} drawings=${draws.length} blocks=${JSON.parse(JSON.stringify(st.asJSON())).length}`);
}
const names = docxEntryNames(new Uint8Array(readFileSync("/tmp/opencode/fid/real-out.docx")));
console.log("docx media:", names.filter((n) => n.startsWith("word/media/")));
console.log("docx parts:", names.filter((n) => !n.startsWith("word/_rels")).join(", "));
process.exit(0);
