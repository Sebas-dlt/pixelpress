import { writeFileSync, mkdirSync } from "node:fs";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  Header,
  Footer,
  PageNumber,
  ImageRun,
} from "docx";

function makeBmp(w, h) {
  const rowSize = Math.ceil((w * 3) / 4) * 4;
  const pixelSize = rowSize * h;
  const fileSize = 54 + pixelSize;
  const buf = Buffer.alloc(fileSize);
  buf.write("BM", 0);
  buf.writeUInt32LE(fileSize, 2);
  buf.writeUInt32LE(54, 10);
  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(w, 18);
  buf.writeInt32LE(h, 22);
  buf.writeUInt16LE(1, 26);
  buf.writeUInt16LE(24, 28);
  buf.writeUInt32LE(pixelSize, 34);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const off = 54 + (h - 1 - y) * rowSize + x * 3;
      const stripe = (x + y) % 40 < 20;
      buf[off] = stripe ? 51 : 237;
      buf[off + 1] = stripe ? 106 : 148;
      buf[off + 2] = stripe ? 235 : 61;
    }
  }
  return buf;
}

const border = { style: BorderStyle.SINGLE, size: 6, color: "000000" };
const cellBorders = {
  top: border,
  bottom: border,
  left: border,
  right: border,
};

const table = new Table({
  width: { size: 100, Type: WidthType.PERCENTAGE },
  rows: [
    ["Producto", "Unidades", "Total"],
    ["PixelPress Pro", "120", "$4.800"],
    ["Soporte anual", "35", "$1.750"],
    ["Total", "155", "$6.550"],
  ].map(
    (cells, i) =>
      new TableRow({
        children: cells.map(
          (c) =>
            new TableCell({
              borders: cellBorders,
              shading: i === 0 ? { fill: "FFE0B2" } : undefined,
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: c, bold: i === 0 })],
                }),
              ],
            }),
        ),
      }),
  ),
});

const children = [
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun("Informe de resultados 2026")],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [
      new TextRun({
        text: "Departamento de Operaciones · Documento confidencial",
        italics: true,
        color: "666666",
        size: 22,
      }),
    ],
  }),
  new Paragraph({
    spacing: { before: 200 },
    children: [
      new TextRun({ text: "Este párrafo mezcla ", size: 24 }),
      new TextRun({ text: "negrita", bold: true, size: 24 }),
      new TextRun({ text: ", ", size: 24 }),
      new TextRun({ text: "cursiva", italics: true, size: 24 }),
      new TextRun({ text: ", ", size: 24 }),
      new TextRun({
        text: "subrayado",
        underline: {},
        size: 24,
      }),
      new TextRun({ text: " y ", size: 24 }),
      new TextRun({ text: "texto en color", color: "7C3AED", size: 24 }),
      new TextRun({
        text: ". También cambia de fuente (Arial) y tamaño (18pt).",
        font: "Arial",
        size: 36,
      }),
    ],
  }),
  new Paragraph({ text: "Objetivos del trimestre:", bold: true }),
  new Paragraph({
    bullet: { level: 0 },
    children: [new TextRun("Aumentar la conversión un 15%")],
  }),
  new Paragraph({
    bullet: { level: 0 },
    children: [new TextRun("Reducir el tiempo de entrega a 48 horas")],
  }),
  new Paragraph({
    bullet: { level: 0 },
    children: [new TextRun("Lanzar la versión móvil")],
  }),
  new Paragraph({
    numbering: { reference: "steps", level: 0 },
    children: [new TextRun("Auditar el proceso actual")],
  }),
  new Paragraph({
    numbering: { reference: "steps", level: 0 },
    children: [new TextRun("Definir métricas clave")],
  }),
  new Paragraph({
    numbering: { reference: "steps", level: 0 },
    children: [new TextRun("Ejecutar el piloto")],
  }),
  new Paragraph({
    spacing: { before: 200 },
    children: [new TextRun({ text: "Resultados por línea de negocio", bold: true })],
  }),
  table,
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 200 },
    children: [
      new ImageRun({
        type: "bmp",
        data: makeBmp(300, 150),
        transformation: { width: 300, height: 150 },
      }),
    ],
  }),
  new Paragraph({
    alignment: AlignmentType.RIGHT,
    children: [
      new TextRun({
        text: "— Fin de la primera página",
        italics: true,
        color: "999999",
      }),
    ],
  }),
  new Paragraph({ pageBreakBefore: true, text: "Anexo A: metodología" }),
  new Paragraph({
    children: [
      new TextRun(
        "Los datos se recogieron entre enero y marzo. La muestra incluyó 1.550 respuestas validadas con un margen de error del 2,3%.",
      ),
    ],
  }),
  new Paragraph({
    children: [
      new TextRun({
        text: "Nota: este anexo ocupa la segunda página para verificar la paginación.",
      }),
    ],
  }),
];

const doc = new Document({
  numbering: {
    config: [
      {
        reference: "steps",
        levels: [
          {
            level: 0,
            format: "decimal",
            text: "%1.",
            alignment: AlignmentType.START,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          },
        ],
      },
    ],
  },
  sections: [
    {
      properties: {},
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                new TextRun({
                  text: "PixelPress · Informe 2026",
                  size: 16,
                  color: "888888",
                }),
              ],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: "Página ", size: 16 }),
                new TextRun({
                  children: [PageNumber.CURRENT],
                  size: 16,
                }),
                new TextRun({ text: " de ", size: 16 }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16 }),
              ],
            }),
          ],
        }),
      },
      children,
    },
  ],
});

mkdirSync("spikes/out", { recursive: true });
writeFileSync("spikes/out/fixture.docx", await Packer.toBuffer(doc));
console.log("fixture.docx escrito");
