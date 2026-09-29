import { readFileSync } from "node:fs";
import * as mupdf from "mupdf";
const files = process.argv.slice(2);
const all = files.map((f) => {
  const doc = mupdf.Document.openDocument(readFileSync(f), "application/pdf");
  const out = [];
  for (let p = 0; p < doc.countPages(); p++) {
    const st = doc.loadPage(p).toStructuredText("preserve-whitespace");
    let buf = "";
    st.walk({
      beginLine(b) { buf = JSON.stringify(b.map(n => Math.round(n * 10) / 10)); },
      onChar(c) { buf += c; },
      endLine() { out.push(`p${p} ${buf}`); },
    });
  }
  doc.destroy();
  return out;
});
const max = Math.max(...all.map(a => a.length));
for (let i = 0; i < max; i++) {
  const a = all[0][i] ?? "";
  const b = all[1][i] ?? "";
  console.log("A:", a.slice(0, 105));
  console.log("B:", b.slice(0, 105));
  console.log();
}
process.exit(0);
