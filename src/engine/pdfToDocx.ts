import * as mupdf from "mupdf";
import {
  AlignmentType,
  BorderStyle,
  HorizontalPositionRelativeFrom,
  TextWrappingSide,
  TextWrappingType,
  VerticalPositionRelativeFrom,
  Document as DocxDocument,
  ImageRun,
  Paragraph,
  Packer,
  Table,
  TableCell,
  TableRow,
  TextRun,
  TableLayoutType,
  WidthType,
  LineRuleType,
  VerticalAlignTable,
} from "docx";

export class ScannedPdfError extends Error {}
export class ProtectedPdfError extends Error {}

type Rect = number[];
type Rgb = [number, number, number];
type Alignment = (typeof AlignmentType)[keyof typeof AlignmentType];

type PChar = {
  c: string;
  ox: number;
  oy: number;
  size: number;
  font: string;
  bold: boolean;
  italic: boolean;
  color: Rgb;
  under: boolean;
};

type PLine = { bbox: Rect; chars: PChar[] };
type Entry = { line: PLine; block: PBlock };
type PBlock = { lines: PLine[] };

type Stroke = {
  horizontal: boolean;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color: Rgb;
};

type Fill = { x0: number; y0: number; x1: number; y1: number; color: Rgb };

type PImage = { bbox: Rect; png: Uint8Array };

type Region = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  xs: number[];
  ys: number[];
  strokes: Stroke[];
  fills: Fill[];
};

type CellSeg = { y: number; x0: number; x1: number; chars: PChar[] };
type CellData = CellSeg[];

type Item = {
  kind: "para" | "image" | "table" | "cols";
  page: number;
  y0: number;
  y1: number;
  x0: number;
  rows?: Row[];
  ind?: number;
  image?: PImage;
  float?: boolean;
  region?: Region;
  cells?: CellData[][];
  align?: Alignment;
  line?: number;
  padTop?: number;
  padBot?: number;
  before?: number;
  columns?: { left: number; right?: number; items: Item[] }[];
};

type PageData = {
  bounds: Rect;
  blocks: PBlock[];
  images: PImage[];
  strokes: Stroke[];
  fills: Fill[];
  regions: Region[];
  artRects: Rect[];
};

const STXT = "preserve-images,preserve-whitespace,vectors";
const TOL = 3;
const CLUSTER_TOL = 1.5;

const FONT_MAP: Record<string, string> = {
  liberationsans: "Arial",
  liberationserif: "Times New Roman",
  liberationmono: "Courier New",
  carlito: "Calibri",
  caladea: "Cambria",
  helvetica: "Arial",
  times: "Times New Roman",
  timesnewroman: "Times New Roman",
  courier: "Courier New",
};

function fontName(raw: string): string {
  const n = raw.replace(/^[A-Z]{6}\+/, "");
  const base = n.split("-")[0].replace(/(BoldOblique|BoldItalic|Bold|Italic|Oblique|Regular|MT|PS|PSMT)$/i, "");
  return FONT_MAP[base.toLowerCase()] ?? (base || n);
}

function hex(c: Rgb | undefined): string | undefined {
  if (!c || c.every((v) => v < 0.02)) return undefined;
  return c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0").toUpperCase()).join("");
}

function halfPts(size: number): number {
  return Math.max(2, Math.round(size * 2));
}

function twips(pt: number): number {
  return Math.round(pt * 20);
}

function cluster(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const out: number[] = [];
  let sum = 0;
  let cnt = 0;
  let prev = NaN;
  for (const v of sorted) {
    if (cnt && v - prev > CLUSTER_TOL) {
      out.push(sum / cnt);
      sum = 0;
      cnt = 0;
    }
    sum += v;
    cnt++;
    prev = v;
  }
  if (cnt) out.push(sum / cnt);
  return out;
}

function collect(page: mupdf.Page): Omit<PageData, "bounds" | "regions"> {
  const blocks: PBlock[] = [];
  const images: PImage[] = [];
  const strokes: Stroke[] = [];
  const fills: Fill[] = [];
  const art: Rect[] = [];
  const st = page.toStructuredText(STXT);
  let block: PBlock | null = null;
  let line: PLine | null = null;
  st.walk({
    beginTextBlock() {
      block = { lines: [] };
      blocks.push(block);
    },
    beginLine(bbox) {
      line = { bbox: [...bbox], chars: [] };
      (block as PBlock).lines.push(line);
    },
    onChar(c, origin, font, size, _quad, color) {
      const [cr = 0, cg = 0, cb = 0] = color;
      (line as PLine).chars.push({
        c,
        ox: origin[0],
        oy: origin[1],
        size,
        font: fontName(font.getName()),
        bold: font.isBold(),
        italic: font.isItalic(),
        color: [cr, cg, cb],
        under: false,
      });
    },
    endLine() {
      line = null;
    },
    endTextBlock() {
      block = null;
    },
    onImageBlock(bbox, _matrix, image) {
      const px = image.toPixmap();
      try {
        images.push({ bbox: [...bbox], png: px.asPNG() });
      } finally {
        px.destroy();
      }
    },
    onVector(bbox, flags, color) {
      const [x0, y0, x1, y1] = bbox;
      const w = x1 - x0;
      const h = y1 - y0;
      const [cr = 0, cg = 0, cb = 0] = color;
      const rgb: Rgb = [cr, cg, cb];
      // rules: Chrome/Word draw cell borders as thin *fills*, LibreOffice as thin strokes
      if (h <= 2.5 && w > 4) strokes.push({ horizontal: true, x0, y0, x1, y1, color: rgb });
      else if (w <= 2.5 && h > 4) strokes.push({ horizontal: false, x0, y0, x1, y1, color: rgb });
      else if (w > 2 && h > 2 && !flags.isStroked) fills.push({ x0, y0, x1, y1, color: rgb });
      // figures/logos/charts: big art the text layer cannot describe
      if (w >= 60 && h >= 40) art.push(bbox);
    },
  });
  st.destroy();
  const artRects = mergeRects(art).filter((r) => r[2] - r[0] >= 60 && r[3] - r[1] >= 40);
  for (const rect of artRects) {
    const png = rasterArt(page, rect);
    if (png) images.push({ bbox: rect, png });
  }
  return { blocks, images, strokes, fills, artRects };
}

// the same figure arrives as separate fill + stroke passes; union what overlaps
function mergeRects(rects: Rect[]): Rect[] {
  const out: Rect[] = [];
  for (const r of rects) {
    const cur: Rect = [...r];
    let merged = true;
    while (merged) {
      merged = false;
      for (let i = 0; i < out.length; i++) {
        const o = out[i];
        if (cur[0] <= o[2] + 2 && o[0] <= cur[2] + 2 && cur[1] <= o[3] + 2 && o[1] <= cur[3] + 2) {
          cur[0] = Math.min(cur[0], o[0]);
          cur[1] = Math.min(cur[1], o[1]);
          cur[2] = Math.max(cur[2], o[2]);
          cur[3] = Math.max(cur[3], o[3]);
          out.splice(i, 1);
          merged = true;
          break;
        }
      }
    }
    out.push(cur);
  }
  return out;
}

// render just the art's bbox (the pixmap bounds clip the draw device), at 2x for crisp output
function rasterArt(page: mupdf.Page, bbox: Rect): Uint8Array | null {
  try {
    const S = 2;
    const pix = new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB, [bbox[0] * S, bbox[1] * S, bbox[2] * S, bbox[3] * S], false);
    pix.clear(255);
    const dev = new mupdf.DrawDevice(mupdf.Matrix.identity, pix);
    page.run(dev, mupdf.Matrix.scale(S, S));
    dev.close();
    const png = pix.asPNG();
    dev.destroy();
    pix.destroy();
    return png;
  } catch {
    return null;
  }
}

function detectRegions(strokes: Stroke[], fills: Fill[]): Region[] {
  const n = strokes.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const boxes = strokes.map((s) => [s.x0, s.y0, s.x1, s.y1]);
  const near = (a: number[], b: number[]) =>
    a[0] <= b[2] + 1 && b[0] <= a[2] + 1 && a[1] <= b[3] + 1 && b[1] <= a[3] + 1;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (near(boxes[i], boxes[j])) parent[find(i)] = find(j);
  const groups = new Map<number, Stroke[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    const g = groups.get(r);
    if (g) g.push(strokes[i]);
    else groups.set(r, [strokes[i]]);
  }
  const regions: Region[] = [];
  for (const segs of groups.values()) {
    const hs = segs.filter((s) => s.horizontal);
    const vs = segs.filter((s) => !s.horizontal);
    const xs = cluster(vs.map((s) => (s.x0 + s.x1) / 2));
    const ys = cluster(hs.map((s) => (s.y0 + s.y1) / 2));
    if (xs.length < 2 || ys.length < 2) continue;
    regions.push({
      x0: Math.min(...segs.map((s) => s.x0)),
      y0: Math.min(...segs.map((s) => s.y0)),
      x1: Math.max(...segs.map((s) => s.x1)),
      y1: Math.max(...segs.map((s) => s.y1)),
      xs,
      ys,
      strokes: segs,
      fills: [],
    });
  }
  if (regions.length) return regions;
  return detectRuleTable(strokes, fills);
}

type Band = { y: number; segs: Stroke[]; x0: number; x1: number };

// Chrome/Word tables carry only horizontal row separators (split per cell, no
// verticals at all), so the grid above finds nothing. Chain bands of rules that
// share one x-span, then take columns from the segment ends.
function detectRuleTable(strokes: Stroke[], fills: Fill[]): Region[] {
  const horiz = strokes
    .filter((s) => s.horizontal && s.x1 - s.x0 >= 15)
    .sort((a, b) => (a.y0 + a.y1) / 2 - (b.y0 + b.y1) / 2);
  const bands: Band[] = [];
  for (const s of horiz) {
    const y = (s.y0 + s.y1) / 2;
    const last = bands[bands.length - 1];
    if (last && Math.abs(last.y - y) <= CLUSTER_TOL) {
      last.segs.push(s);
      last.x0 = Math.min(last.x0, s.x0);
      last.x1 = Math.max(last.x1, s.x1);
    } else bands.push({ y, segs: [s], x0: s.x0, x1: s.x1 });
  }
  const regions: Region[] = [];
  let chain: Band[] = [];
  const flush = () => {
    // >=3 rules of the same width: single-column rules (heading underlines) have one segment
    if (chain.length >= 3 && chain.every((b) => b.segs.length >= 2)) {
      const segs = chain.flatMap((b) => b.segs);
      const xs = cluster(segs.flatMap((s) => [s.x0, s.x1]));
      const x0 = Math.min(...segs.map((s) => s.x0));
      const x1 = Math.max(...segs.map((s) => s.x1));
      const ruleYs = chain.map((b) => b.y);
      // header shading: per-cell fills aligned to column edges, sitting just above the first rule
      const bandEdges = fills
        .filter(
          (f) =>
            f.y1 >= ruleYs[0] - 60 &&
            f.y0 <= ruleYs[0] - 1 &&
            f.y1 <= ruleYs[0] + 5 &&
            f.x1 - f.x0 >= 15 &&
            xs.some((x) => Math.abs(f.x0 - x) <= CLUSTER_TOL) &&
            xs.some((x) => Math.abs(f.x1 - x) <= CLUSTER_TOL),
        )
        .flatMap((f) => [f.y0, f.y1]);
      const ys = cluster([...ruleYs, ...bandEdges]);
      if (xs.length >= 2 && ys.length >= 2) {
        regions.push({
          x0,
          y0: Math.min(segs[0].y0, ys[0] - 1),
          x1,
          y1: Math.max(segs[segs.length - 1].y1, ys[ys.length - 1] + 1),
          xs,
          ys,
          strokes: segs,
          fills: [],
        });
      }
    }
    chain = [];
  };
  for (const b of bands.filter((x) => x.segs.length >= 2)) {
    const prev = chain[chain.length - 1];
    if (prev && Math.abs(prev.x0 - b.x0) <= 2 && Math.abs(prev.x1 - b.x1) <= 2 && b.y - prev.y <= 150) {
      chain.push(b);
    } else {
      flush();
      chain = [b];
    }
  }
  flush();
  return regions;
}

function inRegion(r: Region, cx: number, cy: number): boolean {
  return cx >= r.x0 - 0.5 && cx <= r.x1 + 0.5 && cy >= r.y0 - 0.5 && cy <= r.y1 + 0.5;
}

function colOf(r: Region, ox: number): number {
  let col = 0;
  for (let j = 0; j < r.xs.length; j++) if (ox >= r.xs[j] - 0.6) col = j;
  return Math.min(col, r.xs.length - 2);
}

function rowOf(r: Region, cy: number): number {
  let row = 0;
  for (let i = 0; i < r.ys.length; i++) if (cy >= r.ys[i] - 0.6) row = i;
  return Math.min(row, r.ys.length - 2);
}

function markUnderlines(lines: PLine[], strokes: Stroke[], regions: Region[]) {
  const tableStrokes = new Set(regions.flatMap((r) => r.strokes));
  for (const s of strokes) {
    if (!s.horizontal || tableStrokes.has(s)) continue;
    for (const line of lines) {
      const [lx0, , lx1] = line.bbox;
      if (s.x0 < lx0 - 1 || s.x1 > lx1 + 1) continue;
      for (const ch of line.chars) {
        if (ch.ox + 0.5 > s.x1 || ch.ox + ch.size * 0.6 < s.x0 - 1) continue;
        const rel = (s.y0 + s.y1) / 2 - ch.oy;
        if (rel >= -1 && rel <= Math.max(1.5, ch.size * 0.15)) ch.under = true;
      }
    }
  }
}

function runsOf(chars: PChar[]): TextRun[] {
  const runs: TextRun[] = [];
  let key = "";
  let buf = "";
  let cur: PChar | null = null;
  const flush = () => {
    if (!cur || !buf) return;
    const color = hex(cur.color);
    runs.push(
      new TextRun({
        text: buf,
        font: cur.font,
        size: halfPts(cur.size),
        bold: cur.bold,
        italics: cur.italic,
        underline: cur.under ? { type: "single" } : undefined,
        ...(color ? { color } : {}),
      }),
    );
    buf = "";
  };
  for (const ch of chars) {
    const k = `${ch.font}|${halfPts(ch.size)}|${ch.bold}|${ch.italic}|${ch.under}|${hex(ch.color) ?? ""}`;
    if (k !== key) {
      flush();
      key = k;
      cur = ch;
    }
    if (!cur) cur = ch;
    buf += ch.c;
  }
  flush();
  return runs;
}

type Row = { segs: PLine[]; blocks: Set<PBlock>; oy: number };

function baseline(line: PLine): number {
  return line.chars[0]?.oy ?? line.bbox[1];
}

function buildRows(kept: { line: PLine; block: PBlock }[]): Row[] {
  kept.sort((a, b) => baseline(a.line) - baseline(b.line) || a.line.bbox[0] - b.line.bbox[0]);
  const rows: Row[] = [];
  for (const { line, block } of kept) {
    const oy = baseline(line);
    const cur = rows[rows.length - 1];
    if (cur && Math.abs(oy - cur.oy) <= 2.5) {
      cur.segs.push(line);
      cur.blocks.add(block);
    } else {
      rows.push({ segs: [line], blocks: new Set([block]), oy });
    }
  }
  for (const row of rows) row.segs.sort((a, b) => a.bbox[0] - b.bbox[0]);
  return rows;
}

function paraChars(rowList: Row[]): PChar[] {
  const out: PChar[] = [];
  const sep = (src: PChar) => {
    if (out.length && out[out.length - 1].c !== " ") out.push({ ...src, c: " " });
  };
  for (let ri = 0; ri < rowList.length; ri++) {
    let prev: PLine | null = null;
    let prevTrail = false;
    for (const seg of rowList[ri].segs) {
        let chars = seg.chars;
        let trail = false;
        while (chars.length && chars[chars.length - 1].c === " ") {
          trail = true;
          chars = chars.slice(0, -1);
        }
        const gap = prev ? seg.bbox[0] - prev.bbox[2] : ri > 0 ? 99 : -1;
        // a stripped trailing space is still a word break between split runs
        const needSep = prev ? gap > 1 || prevTrail : ri > 0;
        prevTrail = trail;
        if (needSep) {
          while (chars.length && chars[0].c === " ") chars = chars.slice(1);
          const src = chars[0] ?? out[out.length - 1];
          if (src) sep(src);
        }
      out.push(...chars);
      prev = seg;
    }
  }
  return out;
}

function alignRect(x0: number, x1: number, left: number, right: number): Alignment {
  const mid = (x0 + x1) / 2;
  const pageMid = (left + right) / 2;
  if (Math.abs(x0 - left) <= TOL) return AlignmentType.LEFT;
  if (Math.abs(x1 - right) <= TOL) return AlignmentType.RIGHT;
  if (Math.abs(mid - pageMid) <= TOL) return AlignmentType.CENTER;
  return AlignmentType.LEFT;
}

export async function pdfToDocx(pdfBytes: Uint8Array): Promise<Uint8Array> {
  const doc = mupdf.Document.openDocument(pdfBytes, "application/pdf");
  try {
    if (doc.needsPassword()) throw new ProtectedPdfError("El PDF está protegido con contraseña.");
    const pageCount = doc.countPages();
    const pages: PageData[] = [];
    let totalChars = 0;
    for (let i = 0; i < pageCount; i++) {
      const page = doc.loadPage(i);
      const data = collect(page);
      totalChars += data.blocks.reduce((n, b) => n + b.lines.reduce((m, l) => m + l.chars.length, 0), 0);
      pages.push({ bounds: [...page.getBounds()], ...data, regions: detectRegions(data.strokes, data.fills) });
      page.destroy();
    }
    if (totalChars === 0) throw new ScannedPdfError("El PDF no tiene texto selectable (parece escaneado).");

    const items: Item[] = [];
    const contents: { x0: number; y0: number; x1: number; y1: number }[] = [];

    // Una corriente es un flujo vertical independiente (ancho completo o una columna):
    // encadena sus propios párrafos y calcula sus propios huecos.
    type Stream = {
      entries: Entry[];
      left: number;
      right: number;
      items: Item[];
      bottom: number;
      padBot: number;
      page: number;
    };
    const makeStream = (entries: Entry[]): Stream => ({
      entries,
      left: entries.length ? Math.min(...entries.map((e) => e.line.bbox[0])) : 0,
      right: entries.length ? Math.max(...entries.map((e) => e.line.bbox[2])) : 0,
      items: [],
      bottom: NaN,
      padBot: 0,
      page: -1,
    });

    // Los renglones que arrancan en la misma x forman columnas; los que cruzan hacia la
    // siguiente columna (títulos y párrafos de ancho completo) quedan en la corriente general.
    const splitColumns = (kept: Entry[]): Stream[] => {
      const byX = [...kept].sort((a, b) => a.line.bbox[0] - b.line.bbox[0]);
      const clusters: { min: number; max: number; items: Entry[] }[] = [];
      for (const e of byX) {
        const x0 = e.line.bbox[0];
        const last = clusters[clusters.length - 1];
        if (last && x0 - last.max <= 6) {
          last.items.push(e);
          last.max = Math.max(last.max, x0);
        } else clusters.push({ min: x0, max: x0, items: [e] });
      }
      const starts: number[] = [];
      const yr: [number, number][] = [];
      for (const c of clusters) {
        if (c.items.length < 3) continue;
        if (starts.length && c.min - starts[starts.length - 1] < 60) continue;
        starts.push(c.min);
        yr.push([
          Math.min(...c.items.map((e) => e.line.bbox[1])),
          Math.max(...c.items.map((e) => e.line.bbox[3])),
        ]);
      }
      if (starts.length < 2) return [makeStream(kept)];
      // una columna solo existe donde otra la acompaña en altura: el pie de figura o el
      // último bloque de la página no arrastran a toda la página a una tabla de 2 columnas
      const win: [number, number][] = yr.map(() => [Infinity, -Infinity]);
      for (let i = 0; i < starts.length; i++) {
        for (let j = 0; j < starts.length; j++) {
          if (i === j) continue;
          const a = Math.max(yr[i][0], yr[j][0]);
          const b = Math.min(yr[i][1], yr[j][1]);
          if (b - a < 24) continue;
          win[i][0] = Math.min(win[i][0], a);
          win[i][1] = Math.max(win[i][1], b);
        }
      }
      const span: Entry[] = [];
      const cols: Entry[][] = starts.map(() => []);
      for (const e of kept) {
        const x0 = e.line.bbox[0];
        let k = -1;
        for (let i = 0; i < clusters.length && k < 0; i++) {
          if (x0 < clusters[i].min - 6 || x0 > clusters[i].max + 6) continue;
          const ci = starts.indexOf(clusters[i].min);
          if (ci >= 0) k = ci;
        }
        const cy = (e.line.bbox[1] + e.line.bbox[3]) / 2;
        const limit = k >= 0 && k + 1 < starts.length ? starts[k + 1] - 12 : Infinity;
        if (k < 0 || cy < win[k][0] || cy > win[k][1] || e.line.bbox[2] > limit) span.push(e);
        else cols[k].push(e);
      }
      const streams = [makeStream(span), ...cols.map(makeStream)].filter((st, i) => i === 0 || st.entries.length > 0);
      // hace falta ancho completo + al menos dos columnas con renglones
      if (streams.length < 3) return [makeStream(kept)];
      return streams;
    };

    const chainStream = (stream: Stream, p: number): void => {
      const extS = { left: stream.left, right: stream.right };
      const rows = buildRows(stream.entries);
      let chain: Row[] = [];
      let chainBlocks = new Set<PBlock>();
      const flushChain = () => {
        if (chain.length === 0) return;
        const firstLines = chain[0].segs;
        const lastRow = chain[chain.length - 1];
        const align = alignRect(firstLines[0].bbox[0], firstLines[0].bbox[2], extS.left, extS.right);
        const rowX0 = Math.min(...firstLines.map((l) => l.bbox[0]));
        stream.items.push({
          kind: "para",
          page: p,
          y0: Math.min(...firstLines.map((l) => l.bbox[1])),
          y1: Math.max(...lastRow.segs.map((l) => l.bbox[3])),
          x0: rowX0,
          rows: chain,
          align,
          ind: align === AlignmentType.LEFT && rowX0 - extS.left > 0.5 ? rowX0 - extS.left : 0,
        });
        chain = [];
        chainBlocks = new Set();
      };
      const rowText = (row: Row): string =>
        row.segs.map((l) => l.chars.map((c) => c.c).join("")).join(" ").trimStart();
      const isListItem = (row: Row): boolean => {
        const t = rowText(row);
        return /^[\u2022\u25CF\u25AA\u25E6\u2023\u2043*+\u00B7-]\s*\S/.test(t) || /^\d{1,2}[.)](\s|$)/.test(t);
      };
      const styleKey = (c: PChar): string => `${c.bold}|${c.italic}|${halfPts(c.size)}|${c.font}`;
      // ponytail: a row ending well short of the right edge reads as paragraph end (MuPDF merges
      // adjacent same-style paragraphs into one block); false-positives only on mid-para short lines
      const shortLine = (row: Row): boolean =>
        row.segs[row.segs.length - 1].bbox[2] - extS.left < 0.6 * (extS.right - extS.left);
      for (const row of rows) {
        if (chain.length && shortLine(chain[chain.length - 1])) flushChain();
        const shared = [...row.blocks].some((b) => chainBlocks.has(b));
        // ponytail: break on style flip at row boundary; over-eager if a paragraph changes font mid-wrap
        const prevRow = chain[chain.length - 1];
        const prevEnd = prevRow?.segs[prevRow.segs.length - 1].chars.at(-1);
        const start = row.segs[0].chars[0];
        const flip = prevEnd && start && styleKey(prevEnd) !== styleKey(start);
        if (chain.length && (!shared || isListItem(row) || flip)) flushChain();
        chain.push(row);
        for (const b of row.blocks) chainBlocks.add(b);
      }
      flushChain();
    };

    // Huecos e interlineado: se resuelven aquí porque cada corriente tiene su propio ritmo.
    // Interlineado exacto = distancia entre bases de renglones consecutivos del párrafo.
    const fillGeometry = (stream: Stream): void => {
      stream.items.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
      for (const item of stream.items) {
        // la figura flotante está anclada a la página: no ocupa alto ni gana hueco
        if (item.float) {
          item.before = 0;
          item.line = 20;
          item.padTop = 0;
          item.padBot = 0;
          continue;
        }
        const first = stream.page !== item.page;
        const gap = first || Number.isNaN(stream.bottom) ? 0 : item.y0 - stream.bottom;
        let padTop = 0;
        let padBot = 0;
        let line: number | undefined;
        if (item.kind === "para" && item.rows) {
          const leadFirst = Math.max(...item.rows[0].segs.map((l) => l.bbox[3] - l.bbox[1]));
          const lastRow = item.rows[item.rows.length - 1];
          const leadLast = Math.max(...lastRow.segs.map((l) => l.bbox[3] - l.bbox[1]));
          const dys: number[] = [];
          for (let i = 1; i < item.rows.length; i++) {
            dys.push(baseline(item.rows[i].segs[0]) - baseline(item.rows[i - 1].segs[0]));
          }
          dys.sort((a, b) => a - b);
          const measured = dys.length ? dys[dys.length >> 1] : 0;
          const lineH = measured > leadFirst * 0.8 ? measured : leadFirst * 1.04;
          padTop = 0.8 * (lineH - leadFirst);
          padBot = 0.2 * (lineH - leadLast);
          line = Math.round(lineH * 20);
        } else if (item.kind === "image") {
          line = Math.round(Math.max(1, item.image!.bbox[3] - item.image!.bbox[1]) * 20);
        }
        item.line = line;
        item.padTop = padTop;
        item.padBot = padBot;
        item.before = twips(Math.max(0, gap - stream.padBot - padTop));
        stream.bottom = first || Number.isNaN(stream.bottom) ? item.y1 : Math.max(stream.bottom, item.y1);
        stream.padBot = padBot;
        stream.page = item.page;
      }
    };

    for (let p = 0; p < pages.length; p++) {
      const pg = pages[p];
      markUnderlines(pg.blocks.flatMap((b) => b.lines), pg.strokes, pg.regions);
      const kept: Entry[] = [];
      for (const block of pg.blocks) {
        for (const line of block.lines) {
          if (line.chars.length === 0) continue;
          const cx = (line.bbox[0] + line.bbox[2]) / 2;
          const cy = (line.bbox[1] + line.bbox[3]) / 2;
          if (pg.regions.some((r) => inRegion(r, cx, cy))) continue;
          if (pg.artRects.some((a) => cx >= a[0] && cx <= a[2] && cy >= a[1] && cy <= a[3])) continue;
          kept.push({ line, block });
          contents.push({ x0: line.bbox[0], y0: line.bbox[1], x1: line.bbox[2], y1: line.bbox[3] });
        }
      }
      const streams = splitColumns(kept);
      const span = streams[0];
      if (typeof process !== "undefined" && process.env?.PP_DEBUG) {
        console.error(
          `p${p} corrientes=${streams.length} renglones=${streams.map((st) => st.entries.length).join("/")} imgs=${pg.images
            .map((im) => im.bbox.map((v) => Math.round(v)).join(","))
            .join(" | ")}`,
        );
      }

      // tablas: si caben dentro de una columna, van a esa columna
      for (const r of pg.regions) {
        const cols = r.xs.length - 1;
        const rows = r.ys.length - 1;
        r.fills = pg.fills.filter((f) => inRegion(r, (f.x0 + f.x1) / 2, (f.y0 + f.y1) / 2));
        const cells: CellData[][] = Array.from({ length: rows }, () => Array.from({ length: cols }, (): CellData => []));
        for (const block of pg.blocks) {
          for (const line of block.lines) {
            if (line.chars.length === 0) continue;
            const cx = (line.bbox[0] + line.bbox[2]) / 2;
            const cy = (line.bbox[1] + line.bbox[3]) / 2;
            if (!inRegion(r, cx, cy)) continue;
            const row = rowOf(r, cy);
            let last = colOf(r, line.chars[0].ox);
            let seg: PChar[] = [line.chars[0]];
            const push = (cell: number, chars: PChar[], x1: number) =>
              cells[row][cell].push({ y: line.bbox[1], x0: chars[0].ox, x1, chars });
            for (let i = 1; i < line.chars.length; i++) {
              const col = colOf(r, line.chars[i].ox);
              if (col !== last) {
                push(last, seg, line.chars[i].ox);
                last = col;
                seg = [];
              }
              seg.push(line.chars[i]);
            }
            push(last, seg, line.bbox[2]);
          }
        }
        for (const row of cells) for (const cell of row) cell.sort((a, b) => a.y - b.y);
        const target = streams.find((st, i) => i > 0 && r.x0 >= st.left - 1 && r.x1 <= st.right + 1) ?? span;
        target.items.push({ kind: "table", page: p, y0: r.y0, y1: r.y1, x0: r.x0, region: r, cells });
        contents.push({ x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1 });
      }

      for (const st of streams) chainStream(st, p);

      for (const img of pg.images) {
        const icx = (img.bbox[0] + img.bbox[2]) / 2;
        const icy = (img.bbox[1] + img.bbox[3]) / 2;
        if (pg.regions.some((r) => inRegion(r, icx, icy))) continue;
        // si el original escribe al lado de la figura, la figura flota y el texto la rodea;
        // si la figura vive en un hueco vacío, ocupa su renglón entero
        const float = kept.some((e) => {
          const cy = (e.line.bbox[1] + e.line.bbox[3]) / 2;
          return (
            cy >= img.bbox[1] - 2 &&
            cy <= img.bbox[3] + 2 &&
            (e.line.bbox[2] < img.bbox[0] - 2 || e.line.bbox[0] > img.bbox[2] + 2)
          );
        });
        // la flotante está anclada a la página: su x no decide en qué columna vive
        const target =
          float || !streams.some((st, i) => i > 0 && icx >= st.left - 1 && icx <= st.right + 1)
            ? span
            : streams.find((st, i) => i > 0 && icx >= st.left - 1 && icx <= st.right + 1)!;
        target.items.push({ kind: "image", page: p, y0: img.bbox[1], y1: img.bbox[3], x0: img.bbox[0], image: img, float });
        contents.push({ x0: img.bbox[0], y0: img.bbox[1], x1: img.bbox[2], y1: img.bbox[3] });
      }

      // las columnas pasan a ser una tabla sin bordes: cada una con su contenido y su ritmo
      const used = streams.slice(1).filter((st) => st.items.length);
      const colY0 = used.length ? Math.min(...used.flatMap((st) => st.items.map((i) => i.y0))) : Infinity;
      const colY1 = used.length ? Math.max(...used.flatMap((st) => st.items.map((i) => i.y1))) : -Infinity;
      // si la página se cruza con la banda de columnas, la tabla empujaría ese contenido:
      // se funde todo en una sola corriente y cada línea conserva su x vía sangría
      const clash = span.items.some((it) => Math.min(it.y1, colY1) - Math.max(it.y0, colY0) > 4);
      if (typeof process !== "undefined" && process.env?.PP_DEBUG) {
        console.error(
          `p${p} usados=${used.length} banda=${Math.round(colY0)}..${Math.round(colY1)} clash=${clash} ` +
            `span=${span.items.map((i) => `${i.kind[0]}${Math.round(i.y0)}-${Math.round(i.y1)}`).join(" ")}`,
        );
      }
      if (used.length >= 2 && !clash) {
        for (const st of used) fillGeometry(st);
        span.items.push({
          kind: "cols",
          page: p,
          y0: colY0,
          y1: colY1,
          x0: Math.min(...used.map((st) => st.left)),
          columns: used.map((st) => ({ left: st.left, right: st.right, items: st.items })),
        });
      } else {
        const pageLeft = kept.length ? Math.min(...kept.map((e) => e.line.bbox[0])) : 0;
        for (const st of used) {
          const dx = st.left - pageLeft;
          for (const it of st.items) {
            span.items.push(dx > 0.5 && it.kind === "para" && it.ind ? { ...it, ind: it.ind + dx } : it);
          }
        }
      }
      fillGeometry(span);
      items.push(...span.items);
    }
    items.sort((a, b) => a.page - b.page || a.y0 - b.y0 || a.x0 - b.x0);

    const bounds = pages[0].bounds;
    const pageW = bounds[2] - bounds[0];
    const pageH = bounds[3] - bounds[1];
    // ponytail: one page size + margins for the whole doc; per-page geometry if mixed-size PDFs matter
    // snap to 3pt grid: PDFs exported from docx land near inch/quarter-inch margins,
    // and derived margins drift ±1pt → changes line wrapping vs the original.
    // Bottom floors (not rounds): rounding up shrinks the content box and LO pushes the last line
    // (usually the footer) onto a new page.
    const snap = (v: number) => Math.max(0, Math.round(v / 3) * 3);
    const snapDown = (v: number) => Math.max(0, Math.floor(v / 6) * 6);
    const rawTop = contents.length ? Math.min(...contents.map((c) => c.y0)) - bounds[1] : 0;
    // first line's box seats the glyph ~0.8·(box−ink) below the margin; pull the margin up so ink
    // lands on the PDF's first ink top (this offset otherwise cascades through the whole document)
    const firstPara = items.find((i) => i.kind === "para" && i.rows);
    const firstLead = firstPara?.rows ? Math.max(...firstPara.rows[0].segs.map((l) => l.bbox[3] - l.bbox[1])) : 0;
    const ext = contents.length
      ? {
          left: snap(Math.min(...contents.map((c) => c.x0)) - bounds[0]),
          top: Math.max(0, rawTop - 0.032 * firstLead),
          right: snap(bounds[2] - Math.max(...contents.map((c) => c.x1))),
          // the bottom margin only guards the page break: a document that stops well above
          // the foot would otherwise get a huge margin and its last lines would overflow
          bottom: Math.min(snapDown(bounds[3] - Math.max(...contents.map((c) => c.y1))), 72),
        }
      : { left: 0, top: 0, right: 0, bottom: 0 };
    const contentLeft = bounds[0] + ext.left;
    const contentRight = bounds[2] - ext.right;

    const spacer = (h: number) =>
      new Paragraph({ spacing: { before: 0, after: 0, line: Math.max(1, h), lineRule: LineRuleType.EXACT } });
    const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };

    const emitItem = (item: Item, left: number, brk: boolean, rightInd = 0): (Paragraph | Table)[] => {
      const out: (Paragraph | Table)[] = [];
      const before = item.before ?? 0;
      // el salto se pega al propio primer párrafo: un párrafo vacío aparte ocupa una
      // línea entera y corre toda la página siguiente
      const jump = brk ? { pageBreakBefore: true } : {};
      // las tablas no admiten pageBreakBefore, así que van con un párrafo de 1pt
      const jumpPara = () =>
        new Paragraph({ pageBreakBefore: true, spacing: { before: 0, after: 0, line: 20, lineRule: LineRuleType.EXACT } });

      if (item.kind === "cols") {
        const cols = item.columns!;
        if (brk) out.push(jumpPara());
        if (before > 0) out.push(spacer(before));
        const startLeft = Math.min(...cols.map((c) => c.left));
        const widths = cols.map((c, k) =>
          Math.max(1, (k + 1 < cols.length ? cols[k + 1].left : contentRight) - c.left),
        );
        const cells = cols.map((c, k) => {
          // the cell spans to the next column, but the source text stops earlier: the gutter
          // becomes a right indent so lines wrap where the original wraps
          const nextLeft = k + 1 < cols.length ? cols[k + 1].left : contentRight;
          const gut = Math.max(0, nextLeft - (c.right ?? nextLeft));
          return new TableCell({
            // LO centers cell text vertically by default: the columns must hang from the row top
            verticalAlign: VerticalAlignTable.TOP,
            margins: {
              top: twips(Math.max(0, Math.min(...c.items.map((i) => i.y0)) - item.y0)),
              bottom: 0,
              left: 0,
              right: 0,
            },
            children: c.items.map((child) => emitItem(child, c.left, false, gut)).flat(),
          });
        });
        out.push(
          new Table({
            width: { size: twips(contentRight - startLeft), type: WidthType.DXA },
            ...(startLeft > contentLeft + 0.5
              ? { indent: { size: twips(startLeft - contentLeft), type: WidthType.DXA } }
              : {}),
            layout: TableLayoutType.FIXED,
            columnWidths: widths.map(twips),
            borders: {
              top: noBorder,
              bottom: noBorder,
              left: noBorder,
              right: noBorder,
              insideHorizontal: noBorder,
              insideVertical: noBorder,
            },
            rows: [new TableRow({ children: cells })],
          }),
        );
        return out;
      }

      if (item.kind === "table") {
        const r = item.region!;
        const cells = item.cells!;
        if (brk) out.push(jumpPara());
        if (before > 0) out.push(spacer(before));
        const cols = r.xs.length - 1;
        const rows = r.ys.length - 1;
        const thick = r.strokes.reduce((m, s) => m + (s.horizontal ? s.y1 - s.y0 : s.x1 - s.x0), 0) / r.strokes.length;
        const borderSize = Math.min(96, Math.max(2, Math.round(thick * 8)));
        const border = {
          style: BorderStyle.SINGLE,
          size: borderSize,
          color: hex(r.strokes[0].color) ?? "000000",
        };
        // rule-tables (Chrome/Word) have no vertical lines at all
        const hasVertical = r.strokes.some((sv) => !sv.horizontal);
        // LO adds ~one border width (half of top+bottom, borders centered on the edge) to row height
        const borderPt = borderSize / 8;
        const rowList: TableRow[] = [];
        for (let i = 0; i < rows; i++) {
          const rowH = r.ys[i + 1] - r.ys[i];
          const cellList: TableCell[] = [];
          for (let j = 0; j < cols; j++) {
            const segs = cells[i][j];
            const maxSz = segs.reduce((m, s) => Math.max(m, ...s.chars.map((c) => c.size)), 10);
            // exact cell line = ink × 1.04 so row height = 2·margins + n·lineH lands on rowH exactly
            const lineH = maxSz * 1.1 * 1.04;
            const pad = Math.max(0, twips((rowH - borderPt - (segs.length || 1) * lineH) / 2));
            const fcx = (r.xs[j] + r.xs[j + 1]) / 2;
            const fcy = (r.ys[i] + r.ys[i + 1]) / 2;
            const fill = r.fills.find((f) => fcx >= f.x0 && fcx <= f.x1 && fcy >= f.y0 && fcy <= f.y1);
            const color = hex(fill?.color ?? [1, 1, 1]);
            // cell text keeps the source's alignment inside the cell (numbers usually sit right)
            let jc: Alignment = AlignmentType.LEFT;
            if (segs.length) {
              const pl = Math.min(...segs.map((s) => s.x0)) - r.xs[j];
              const pr = r.xs[j + 1] - Math.max(...segs.map((s) => s.x1));
              if (pr < pl - 6) jc = AlignmentType.RIGHT;
              else if (Math.abs(pl - pr) <= 4 && pl > 3) jc = AlignmentType.CENTER;
            }
            cellList.push(
              new TableCell({
                margins: { top: pad, bottom: pad },
                ...(color ? { shading: { fill: color } } : {}),
                children: segs.length
                  ? segs.map(
                      (seg) =>
                        new Paragraph({
                          children: runsOf(seg.chars),
                          alignment: jc,
                          spacing: {
                            before: 0,
                            after: 0,
                            line: Math.round(lineH * 20),
                            lineRule: LineRuleType.EXACT,
                          },
                        }),
                    )
                  : [new Paragraph({ children: [], spacing: { before: 0, after: 0 } })],
              }),
            );
          }
          rowList.push(new TableRow({ children: cellList }));
        }
        out.push(
          new Table({
            width: { size: twips(r.x1 - r.x0), type: WidthType.DXA },
            layout: TableLayoutType.FIXED,
            columnWidths: r.xs.slice(1).map((x, k) => twips(x - r.xs[k])),
            borders: {
              top: hasVertical ? border : noBorder,
              bottom: border,
              left: hasVertical ? border : noBorder,
              right: hasVertical ? border : noBorder,
              insideHorizontal: border,
              insideVertical: hasVertical ? border : noBorder,
            },
            rows: rowList,
          }),
        );
        return out;
      }

      if (item.kind === "image") {
        const img = item.image!;
        const h = img.bbox[3] - img.bbox[1];
        const EMU = 12700;
        if (item.float) {
          // ancla en coordenadas de página + wrap: el párrafo no consume alto
          const pg = pages[item.page];
          out.push(
            new Paragraph({
              ...jump,
              spacing: { before: 0, after: 0, line: 20, lineRule: LineRuleType.EXACT },
              children: [
                new ImageRun({
                  type: "png",
                  data: img.png,
                  transformation: {
                    width: Math.max(1, Math.round(((img.bbox[2] - img.bbox[0]) * 96) / 72)),
                    height: Math.max(1, Math.round((h * 96) / 72)),
                  },
                  floating: {
                    horizontalPosition: {
                      relative: HorizontalPositionRelativeFrom.PAGE,
                      offset: Math.round((img.bbox[0] - pg.bounds[0]) * EMU),
                    },
                    verticalPosition: {
                      relative: VerticalPositionRelativeFrom.PAGE,
                      offset: Math.round((img.bbox[1] - pg.bounds[1]) * EMU),
                    },
                    wrap: { type: TextWrappingType.SQUARE, side: TextWrappingSide.BOTH_SIDES },
                  },
                }),
              ],
            }),
          );
          return out;
        }
        // en línea: el renglón ocupa exactamente la altura de la figura y el sangrado la
        // coloca en su columna; el texto siguiente cae debajo, sin rodearla
        out.push(
          new Paragraph({
            ...jump,
            spacing: { before, after: 0, line: item.line ?? Math.round(Math.max(1, h) * 20), lineRule: LineRuleType.EXACT },
            indent: { left: twips(Math.max(0, img.bbox[0] - left)) },
            children: [
              new ImageRun({
                type: "png",
                data: img.png,
                transformation: {
                  width: Math.max(1, Math.round(((img.bbox[2] - img.bbox[0]) * 96) / 72)),
                  height: Math.max(1, Math.round((h * 96) / 72)),
                },
              }),
            ],
          }),
        );
        return out;
      }

      const chars = paraChars(item.rows!);
      // list items in the source are bullet/number + tab + text (tab lands on the default stop)
      const marker = /^([•●▪‣◦*+\u00B7-]|\d{1,2}[.)])( +)/.exec(chars.map((c) => c.c).join(""));
      const runs = marker
        ? [...runsOf(chars.slice(0, marker[1].length)), new TextRun({ text: "\t" }), ...runsOf(chars.slice(marker[0].length))]
        : runsOf(chars);
      out.push(
        new Paragraph({
          ...jump,
          spacing: { before, after: 0, ...(item.line ? { line: item.line, lineRule: LineRuleType.EXACT } : {}) },
          alignment: item.align ?? AlignmentType.LEFT,
          ...(item.ind || rightInd > 0.5
            ? { indent: { left: twips(item.ind ?? 0), ...(rightInd > 0.5 ? { right: twips(rightInd) } : {}) } }
            : {}),
          children: runs.length ? runs : [new TextRun("")],
        }),
      );
      return out;
    };

    const children: (Paragraph | Table)[] = [];
    let lastPage = -1;
    for (const item of items) {
      const brk = item.page !== lastPage && children.length > 0;
      if (item.page !== lastPage) lastPage = item.page;
      children.push(...emitItem(item, contentLeft, brk));
    }

    const out = new DocxDocument({
      creator: "PixelPress",
      description: "Convertido en tu navegador con PixelPress",
      sections: [
        {
          properties: {
            page: {
              size: { width: twips(pageW), height: twips(pageH) },
              margin: { left: twips(ext.left), top: twips(ext.top), right: twips(ext.right), bottom: twips(ext.bottom) },
            },
          },
          children,
        },
      ],
    });
    return b64ToBytes(await Packer.toBase64String(out));
  } finally {
    doc.destroy();
  }
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
