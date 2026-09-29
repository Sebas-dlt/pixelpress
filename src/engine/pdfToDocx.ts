import * as mupdf from "mupdf";
import {
  AlignmentType,
  BorderStyle,
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

type CellSeg = { y: number; chars: PChar[] };
type CellData = CellSeg[];

type Item = {
  kind: "para" | "image" | "table";
  page: number;
  y0: number;
  y1: number;
  x0: number;
  rows?: Row[];
  ind?: number;
  image?: PImage;
  region?: Region;
  cells?: CellData[][];
  align?: Alignment;
};

type PageData = {
  bounds: Rect;
  blocks: PBlock[];
  images: PImage[];
  strokes: Stroke[];
  fills: Fill[];
  regions: Region[];
};

const STXT = "preserve-images,preserve-whitespace,vectors";
const TOL = 3;
const CLUSTER_TOL = 1.5;

const FONT_MAP: Record<string, string> = {
  librationsans: "Arial",
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
      if (flags.isStroked) {
        if (h <= 2.5 && w > 4) strokes.push({ horizontal: true, x0, y0, x1, y1, color: rgb });
        else if (w <= 2.5 && h > 4) strokes.push({ horizontal: false, x0, y0, x1, y1, color: rgb });
      } else if (w > 2 && h > 2) {
        fills.push({ x0, y0, x1, y1, color: rgb });
      }
    },
  });
  st.destroy();
  return { blocks, images, strokes, fills };
}

function detectRegions(strokes: Stroke[]): Region[] {
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
    for (const seg of rowList[ri].segs) {
        let chars = seg.chars;
        while (chars.length && chars[chars.length - 1].c === " ") chars = chars.slice(0, -1);
        const gap = prev ? seg.bbox[0] - prev.bbox[2] : ri > 0 ? 99 : -1;
        const needSep = prev ? gap > 1 : ri > 0;
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

function pageTextExtents(pg: PageData): { left: number; right: number } {
  const xs = pg.blocks.flatMap((b) => b.lines.filter((l) => l.chars.length).map((l) => [l.bbox[0], l.bbox[2]]));
  if (xs.length === 0) return { left: pg.bounds[0], right: pg.bounds[2] };
  return { left: Math.min(...xs.map((p) => p[0])), right: Math.max(...xs.map((p) => p[1])) };
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
      pages.push({ bounds: [...page.getBounds()], ...data, regions: detectRegions(data.strokes) });
      page.destroy();
    }
    if (totalChars === 0) throw new ScannedPdfError("El PDF no tiene texto selectable (parece escaneado).");

    const items: Item[] = [];
    const contents: { x0: number; y0: number; x1: number; y1: number }[] = [];
    for (let p = 0; p < pages.length; p++) {
      const pg = pages[p];
      markUnderlines(pg.blocks.flatMap((b) => b.lines), pg.strokes, pg.regions);
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
            for (let i = 1; i < line.chars.length; i++) {
              const col = colOf(r, line.chars[i].ox);
              if (col !== last) {
                cells[row][last].push({ y: line.bbox[1], chars: seg });
                last = col;
                seg = [];
              }
              seg.push(line.chars[i]);
            }
            cells[row][last].push({ y: line.bbox[1], chars: seg });
          }
        }
        for (const row of cells) for (const cell of row) cell.sort((a, b) => a.y - b.y);
        items.push({ kind: "table", page: p, y0: r.y0, y1: r.y1, x0: r.x0, region: r, cells });
        contents.push({ x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1 });
      }
      const kept: { line: PLine; block: PBlock }[] = [];
      for (const block of pg.blocks) {
        for (const line of block.lines) {
          if (line.chars.length === 0) continue;
          const cx = (line.bbox[0] + line.bbox[2]) / 2;
          const cy = (line.bbox[1] + line.bbox[3]) / 2;
          if (pg.regions.some((r) => inRegion(r, cx, cy))) continue;
          kept.push({ line, block });
          contents.push({ x0: line.bbox[0], y0: line.bbox[1], x1: line.bbox[2], y1: line.bbox[3] });
        }
      }
      // paragraphs: consecutive visual rows chained while they share a block
      const rows = buildRows(kept);
      let chain: Row[] = [];
      let chainBlocks = new Set<PBlock>();
      const flushChain = () => {
        if (chain.length === 0) return;
        const firstLines = chain[0].segs;
        const lastRow = chain[chain.length - 1];
        const ext = pageTextExtents(pg);
        const align = alignRect(firstLines[0].bbox[0], firstLines[0].bbox[2], ext.left, ext.right);
        const rowX0 = Math.min(...firstLines.map((l) => l.bbox[0]));
        items.push({
          kind: "para",
          page: p,
          y0: Math.min(...firstLines.map((l) => l.bbox[1])),
          y1: Math.max(...lastRow.segs.map((l) => l.bbox[3])),
          x0: rowX0,
          rows: chain,
          align,
          ind: align === AlignmentType.LEFT && rowX0 - ext.left > 0.5 ? rowX0 - ext.left : 0,
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
      const ext = pageTextExtents(pg);
      // ponytail: a row ending well short of the right edge reads as paragraph end (MuPDF merges
      // adjacent same-style paragraphs into one block); false-positives only on mid-para short lines
      const shortLine = (row: Row): boolean =>
        row.segs[row.segs.length - 1].bbox[2] - ext.left < 0.6 * (ext.right - ext.left);
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
      for (const img of pg.images) {
        items.push({ kind: "image", page: p, y0: img.bbox[1], y1: img.bbox[3], x0: img.bbox[0], image: img });
        contents.push({ x0: img.bbox[0], y0: img.bbox[1], x1: img.bbox[2], y1: img.bbox[3] });
      }
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
    const firstLead =
      items[0]?.kind === "para" && items[0].rows
        ? Math.max(...items[0].rows[0].segs.map((l) => l.bbox[3] - l.bbox[1]))
        : 0;
    const ext = contents.length
      ? {
          left: snap(Math.min(...contents.map((c) => c.x0)) - bounds[0]),
          top: Math.max(0, rawTop - 0.032 * firstLead),
          right: snap(bounds[2] - Math.max(...contents.map((c) => c.x1))),
          bottom: snapDown(bounds[3] - Math.max(...contents.map((c) => c.y1))),
        }
      : { left: 0, top: 0, right: 0, bottom: 0 };

    const children: (Paragraph | Table)[] = [];
    let prevPage = -1;
    let prevBottom = 0;
    let prevPadBot = 0;
    for (const item of items) {
      const first = item.page !== prevPage;
      if (first) {
        prevPage = item.page;
        prevPadBot = 0;
      }
      const gap = first ? 0 : item.y0 - prevBottom;
      prevBottom = first ? item.y1 : Math.max(prevBottom, item.y1);
      // Exact line height = ink bbox × 1.04, written in twips (docx EXACT takes twips).
      // LO seats the glyph ~80% down the extra space: padTop=0.8(H−L), padBot=0.2(H−L).
      let padTop = 0;
      let padBot = 0;
      let line: number | undefined;
      if (item.kind === "para" && item.rows) {
        const leadFirst = Math.max(...item.rows[0].segs.map((l) => l.bbox[3] - l.bbox[1]));
        const lastRow = item.rows[item.rows.length - 1];
        const leadLast = Math.max(...lastRow.segs.map((l) => l.bbox[3] - l.bbox[1]));
        const lineH = leadFirst * 1.04;
        padTop = 0.8 * (lineH - leadFirst);
        padBot = 0.2 * (lineH - leadLast);
        line = Math.round(lineH * 20);
      }
      const before = twips(Math.max(0, gap - prevPadBot - padTop));
      prevPadBot = padBot;
      const pageBreak = item.page > 0 && first && children.length > 0;
      const opts = {
        spacing: { before, after: 0, ...(line ? { line, lineRule: LineRuleType.EXACT } : {}) },
        ...(pageBreak ? { pageBreakBefore: true } : {}),
      };

      if (item.kind === "table") {
        const r = item.region!;
        const cells = item.cells!;
        const cols = r.xs.length - 1;
        const rows = r.ys.length - 1;
        if (pageBreak) children.push(new Paragraph({ pageBreakBefore: true }));
        const thick = r.strokes.reduce((m, s) => m + (s.horizontal ? s.y1 - s.y0 : s.x1 - s.x0), 0) / r.strokes.length;
        const borderSize = Math.min(96, Math.max(2, Math.round(thick * 8)));
        const border = {
          style: BorderStyle.SINGLE,
          size: borderSize,
          color: hex(r.strokes[0].color) ?? "000000",
        };
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
            cellList.push(
              new TableCell({
                margins: { top: pad, bottom: pad },
                ...(color ? { shading: { fill: color } } : {}),
                children: segs.length
                  ? segs.map(
                      (seg) =>
                        new Paragraph({
                          children: runsOf(seg.chars),
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
        children.push(
          new Table({
            width: { size: twips(r.x1 - r.x0), type: WidthType.DXA },
            layout: TableLayoutType.FIXED,
            columnWidths: r.xs.slice(1).map((x, k) => twips(x - r.xs[k])),
            borders: {
              top: border,
              bottom: border,
              left: border,
              right: border,
              insideHorizontal: border,
              insideVertical: border,
            },
            rows: rowList,
          }),
        );
        continue;
      }

      const exts = pageTextExtents(pages[item.page]);
      if (item.kind === "image") {
        const img = item.image!;
        children.push(
          new Paragraph({
            ...opts,
            alignment: alignRect(img.bbox[0], img.bbox[2], exts.left, exts.right),
            children: [
              new ImageRun({
                type: "png",
                data: img.png,
                transformation: {
                  width: Math.max(1, Math.round(((img.bbox[2] - img.bbox[0]) * 96) / 72)),
                  height: Math.max(1, Math.round(((img.bbox[3] - img.bbox[1]) * 96) / 72)),
                },
              }),
            ],
          }),
        );
        continue;
      }

      const chars = paraChars(item.rows!);
      // list items in the source are bullet/number + tab + text (tab lands on the default stop)
      const marker = /^([•●▪‣◦*+\u00B7-]|\d{1,2}[.)])( +)/.exec(chars.map((c) => c.c).join(""));
      const runs = marker
        ? [...runsOf(chars.slice(0, marker[1].length)), new TextRun({ text: "\t" }), ...runsOf(chars.slice(marker[0].length))]
        : runsOf(chars);
      children.push(
        new Paragraph({
          ...opts,
          alignment: item.align ?? AlignmentType.LEFT,
          ...(item.ind ? { indent: { left: twips(item.ind) } } : {}),
          children: runs.length ? runs : [new TextRun("")],
        }),
      );
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
