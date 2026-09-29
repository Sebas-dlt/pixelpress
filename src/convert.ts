export type Kind = "pdf" | "docx";

export type Phase = { message: string; percent?: number };

export class ConvertError extends Error {
  kind: "type" | "size" | "scanned" | "protected" | "generic";
  constructor(kind: "type" | "size" | "scanned" | "protected" | "generic", message: string) {
    super(message);
    this.kind = kind;
  }
}

export const MAX_BYTES = 50 * 1024 * 1024;

export function detectKind(name: string): Kind | null {
  const n = name.toLowerCase();
  if (n.endsWith(".pdf")) return "pdf";
  if (n.endsWith(".docx")) return "docx";
  return null;
}

function outName(name: string, ext: string): string {
  return name.replace(/\.[^.]+$/, "") + ext;
}

export async function convertFile(
  file: File,
  onPhase: (p: Phase) => void,
): Promise<{ data: Uint8Array; filename: string; mimeType: string }> {
  const kind = detectKind(file.name);
  if (!kind) throw new ConvertError("type", "Formato no soportado. Sube un PDF o un DOCX.");
  if (file.size > MAX_BYTES)
    throw new ConvertError("size", `El archivo supera el límite de ${Math.round(MAX_BYTES / 1024 / 1024)} MB.`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  return kind === "pdf" ? pdfToDocx(bytes, file.name, onPhase) : docxToPdf(bytes, file.name, onPhase);
}

async function pdfToDocx(bytes: Uint8Array, name: string, onPhase: (p: Phase) => void) {
  onPhase({ message: "Cargando motor PDF…" });
  const mod = await import("./engine/pdfToDocx");
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  onPhase({ message: "Convirtiendo a Word…" });
  try {
    const data = await mod.pdfToDocx(bytes);
    return { data, filename: outName(name, ".docx"), mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
  } catch (e) {
    if (e instanceof mod.ScannedPdfError)
      throw new ConvertError("scanned", "Este PDF no tiene texto seleccionable (parece escaneado); no podemos recuperar su contenido.");
    if (e instanceof mod.ProtectedPdfError) throw new ConvertError("protected", e.message);
    throw new ConvertError("generic", e instanceof Error ? e.message : "No se pudo convertir el PDF.");
  }
}

// LibreOffice occasionally saves a PDF with no fonts at all (a text document
// renders as a blank page, same upstream race as the stall below). Font
// dictionaries are the only cheap marker that survives: a healthy export always
// carries /BaseFont, a broken one never does.
export function pdfHasText(pdf: Uint8Array): boolean {
  const needle = "/BaseFont";
  outer: for (let i = 0; i + needle.length <= pdf.length; i++) {
    for (let j = 0; j < needle.length; j++)
      if (pdf[i + j] !== needle.charCodeAt(j)) continue outer;
    return true;
  }
  return false;
}

// Minimal zip reader over the central directory (the only place that always has
// sizes — writers like `docx`/Word use data descriptors in local headers).
type ZipRec = { name: string; method: number; csize: number; off: number };

function zipCentral(zip: Uint8Array): ZipRec[] {
  const dv = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  let eocd = -1;
  for (let i = zip.length - 22; i >= 0 && i >= zip.length - 22 - 65535; i--)
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  if (eocd < 0) return [];
  const count = dv.getUint16(eocd + 10, true);
  let off = dv.getUint32(eocd + 16, true);
  const out: ZipRec[] = [];
  for (let n = 0; n < count && off + 46 <= zip.length; n++) {
    if (dv.getUint32(off, true) !== 0x02014b50) break;
    const nlen = dv.getUint16(off + 28, true);
    const elen = dv.getUint16(off + 30, true);
    const clen = dv.getUint16(off + 32, true);
    out.push({
      name: new TextDecoder().decode(zip.subarray(off + 46, off + 46 + nlen)),
      method: dv.getUint16(off + 10, true),
      csize: dv.getUint32(off + 20, true),
      off,
    });
    off += 46 + nlen + elen + clen;
  }
  return out;
}

export function docxEntryNames(docx: Uint8Array): string[] {
  return zipCentral(docx).map((r) => r.name);
}

export async function docxEntry(docx: Uint8Array, name: string): Promise<string | null> {
  const rec = zipCentral(docx).find((r) => r.name === name);
  if (!rec) return null;
  const dv = new DataView(docx.buffer, docx.byteOffset, docx.byteLength);
  const local = dv.getUint32(rec.off + 42, true);
  const dataOff = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
  const raw = docx.subarray(dataOff, dataOff + rec.csize);
  if (rec.method !== 8) return new TextDecoder().decode(raw);
  const buf = await new Response(
    new Blob([new Uint8Array(raw)]).stream().pipeThrough(new DecompressionStream("deflate-raw")),
  ).arrayBuffer();
  return new TextDecoder().decode(buf);
}

// So we don't call a blank export a bug for a document that never had text.
export async function docxHasText(docx: Uint8Array): Promise<boolean> {
  const xml = await docxEntry(docx, "word/document.xml");
  return xml === null ? true : xml.includes("<w:t"); // unknown: keep the check armed
}

type Converter = import("@matbee/libreoffice-converter/browser").WorkerBrowserConverter;

let lo: Promise<Converter> | null = null;
// instance behind `lo`, kept even while initialize() is still pending so a
// converter whose init wedges can still be torn down
let loConv: Converter | null = null;
let report: (p: Phase) => void = () => {};
let showProgress = true;

// LibreOffice occasionally wedges in a pure futex wait while scanning fonts (no
// CPU, no I/O) — observed both mid-convert and mid-init — or saves a blank PDF
// from the same race. A wedged attempt never self-resolves in the browser
// (observed >400s), so the only lever is re-rolling with a fresh worker: healthy
// init takes 1.5-4.5s and a healthy convert ~1.5s. Cut the first attempt early so
// stall victims see the retry fast; later attempts keep a generous budget for big
// documents that convert slowly but legitimately. ponytail: fixed budgets, not a
// progress-idle watchdog — LO only emits a handful of coarse progress events, so
// an idle timer would kill slow but healthy conversions.
const STOP_TIMEOUT_MS = 1_000;
const INIT_TIMEOUT_MS = 20_000;
const ATTEMPT_TIMEOUT_MS = [20_000, 60_000, 60_000];

class Stalled extends Error {}
class Blank extends Error {}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Stalled("timeout")), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

async function stopLo(): Promise<void> {
  const conv = loConv;
  lo = null;
  loConv = null;
  if (!conv) return;
  const worker = (conv as unknown as { worker?: Worker | null }).worker;
  try {
    // destroy() first awaits a reply from the worker; a wedged worker never
    // answers (and a never-initialized converter may not even have one), so
    // race it and terminate the port ourselves.
    await Promise.race([conv.destroy(), new Promise((r) => setTimeout(r, STOP_TIMEOUT_MS))]);
  } catch {
    // converter never came up; nothing else to tear down
  }
  worker?.terminate();
}

async function docxToPdf(bytes: Uint8Array, name: string, onPhase: (p: Phase) => void) {
  const { WorkerBrowserConverter } = await import("@matbee/libreoffice-converter/browser");
  report = onPhase;
  showProgress = true;
  onPhase({ message: "Iniciando LibreOffice…" });
  for (let attempt = 0; ; attempt++) {
    if (!lo) {
      if (attempt) {
        showProgress = false; // keep the retry message visible under LO's init spam
        report({ message: "Reintentando la conversión…" });
      }
      const converter = new WorkerBrowserConverter({
        onProgress: (p) => {
          if (showProgress) report({ message: p.message, percent: p.percent });
        },
      });
      loConv = converter;
      lo = converter.initialize().then(() => converter);
    }
    const init = lo;
    try {
      const converter = await withTimeout(init, INIT_TIMEOUT_MS);
      showProgress = true;
      onPhase({ message: attempt ? "Reintentando la conversión…" : "Convirtiendo a PDF…" });
      const res = await withTimeout(
        converter.convert(bytes, { inputFormat: "docx", outputFormat: "pdf" }),
        ATTEMPT_TIMEOUT_MS[Math.min(attempt, ATTEMPT_TIMEOUT_MS.length - 1)],
      );
      if (!pdfHasText(res.data) && (await docxHasText(bytes))) throw new Blank();
      return { data: res.data, filename: outName(name, ".pdf"), mimeType: res.mimeType };
    } catch (e) {
      await stopLo();
      const retryable = e instanceof Stalled || e instanceof Blank;
      if (retryable && attempt < ATTEMPT_TIMEOUT_MS.length - 1) continue;
      if (e instanceof Stalled)
        throw new ConvertError("generic", "LibreOffice tardó demasiado; vuelve a intentarlo.");
      if (e instanceof Blank)
        throw new ConvertError("generic", "LibreOffice no pudo generar el documento; vuelve a intentarlo.");
      throw new ConvertError("generic", e instanceof Error ? e.message : "No se pudo convertir el documento.");
    }
  }
}
