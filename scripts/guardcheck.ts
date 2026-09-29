import { readFileSync } from "node:fs";
import {
  pdfHasText,
  docxHasText,
  docxEntryNames,
  detectKind,
  convertFile,
  ConvertError,
} from "../src/convert.ts";

const load = (p: string) => new Uint8Array(readFileSync(new URL(p, import.meta.url)));

const cases: [string, unknown, unknown][] = [
  // salida: nunca entregar un documento vacío ni perder contenido
  ["exported pdf carries /BaseFont", pdfHasText(load("../spikes/out/fixture.pdf")), true],
  ["blank LO export reads as no text", pdfHasText(load("../spikes/out/blank.pdf")), false],
  ["docx with text", await docxHasText(load("../spikes/out/fixture.docx")), true],
  ["docx without text", await docxHasText(load("../spikes/out/notext.docx")), false],
  ["zip central directory readable", docxEntryNames(load("../spikes/out/fixture.docx")).includes("word/document.xml"), true],
];

// entrada: extensión, tamaño y estado del PDF
const rejects = async (file: File, label: string) => {
  try {
    await convertFile(file, () => {});
    return `${label}: no rechazó`;
  } catch (e) {
    return e instanceof ConvertError ? e.kind : `${label}: error sin ConvertError (${e})`;
  }
};
cases.push(
  ["rejected: unknown extension", await rejects({ name: "a.txt" } as File, "ext"), "type"],
  ["rejected: over the size limit", await rejects({ name: "a.pdf", size: Number.MAX_SAFE_INTEGER } as File, "size"), "size"],
);

const engine = await import("../src/engine/pdfToDocx.ts");
const engineRejects = async (pdf: Uint8Array, label: string) => {
  try {
    await engine.pdfToDocx(pdf);
    return `${label}: no rechazó`;
  } catch (e) {
    if (e instanceof engine.ScannedPdfError) return "scanned";
    if (e instanceof engine.ProtectedPdfError) return "protected";
    return `${label}: error inesperado (${e})`;
  }
};
cases.push(
  ["rejected: pdf without text layer", await engineRejects(load("../spikes/out/blank.pdf"), "scanned"), "scanned"],
  ["rejected: password-protected pdf", await engineRejects(load("../spikes/out/protected.pdf"), "protected"), "protected"],
);

let bad = 0;
for (const [name, got, want] of cases) {
  const ok = got === want;
  if (!ok) bad++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}: got ${got}, want ${want}`);
}
process.exit(bad ? 1 : 0);
