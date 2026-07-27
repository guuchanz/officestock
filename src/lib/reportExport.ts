import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import path from "path";

// Plain WOFF, not WOFF2: fontkit's WOFF2 subsetter throws
// "RangeError: Offset is outside the bounds of the DataView" on certain Thai
// composite glyphs (e.g. any string containing แ, U+0E41), which aborts PDF
// generation before the response is written. The WOFF1 build of the same
// font doesn't hit that subsetting bug.
const THAI_FONT = path.join(
  process.cwd(),
  "node_modules/@fontsource/sarabun/files/sarabun-thai-400-normal.woff"
);

export interface ExcelColumn<T> {
  header: string;
  key: string;
  width: number;
  /** e.g. "#,##0.00" — applied to the whole column when set. */
  numFmt?: string;
  value: (row: T) => string | number;
}

export interface PdfColumn<T> {
  label: string;
  width: number;
  align: "left" | "right" | "center";
  value: (row: T) => string;
}

export async function buildExcelReport<T>(
  sheetName: string,
  columns: ExcelColumn<T>[],
  rows: T[]
) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);

  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  sheet.getRow(1).font = { bold: true };

  for (const row of rows) {
    sheet.addRow(Object.fromEntries(columns.map((c) => [c.key, c.value(row)])));
  }

  for (const c of columns) {
    if (c.numFmt) sheet.getColumn(c.key).numFmt = c.numFmt;
  }

  return workbook.xlsx.writeBuffer();
}

// The Sarabun "thai" subset only contains Thai-script glyphs (no Latin letters or
// digits), so mixed strings like "MS-002" or "+2 ชิ้น" need per-run font switching:
// Thai runs use the embedded Sarabun font, everything else uses pdfkit's built-in Helvetica.
const THAI_RUN = /[฀-๿]+|[^฀-๿]+/g;

function splitRuns(str: string): { text: string; thai: boolean }[] {
  const matches = str.match(THAI_RUN) ?? [str];
  return matches.map((text) => ({ text, thai: /[฀-๿]/.test(text) }));
}

function drawText(
  doc: PDFKit.PDFDocument,
  str: string,
  x: number,
  y: number,
  width: number,
  align: "left" | "right" | "center"
) {
  const runs = splitRuns(str);
  const widths = runs.map((r) => {
    doc.font(r.thai ? "thai" : "Helvetica");
    return doc.widthOfString(r.text);
  });
  const totalWidth = widths.reduce((s, w) => s + w, 0);

  let cx = x;
  if (align === "right") cx = x + width - totalWidth;
  else if (align === "center") cx = x + (width - totalWidth) / 2;

  runs.forEach((r, i) => {
    doc.font(r.thai ? "thai" : "Helvetica");
    doc.text(r.text, cx, y, { lineBreak: false });
    cx += widths[i];
  });
}

export async function buildPdfReport<T>(
  title: string,
  columns: PdfColumn<T>[],
  rows: T[],
  footer?: (rows: T[]) => string
) {
  const doc = new PDFDocument({ margin: 36, size: "A4", layout: "landscape" });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  doc.registerFont("thai", THAI_FONT);

  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  doc.fontSize(16);
  drawText(doc, title, doc.page.margins.left, doc.y, pageWidth, "center");
  doc.moveDown(1.5);

  const startX = doc.page.margins.left;
  const tableWidth = columns.reduce((s, c) => s + c.width, 0);
  let y = doc.y;

  const drawHeader = () => {
    let x = startX;
    doc.fontSize(9).fillColor("#333");
    for (const col of columns) {
      drawText(doc, col.label, x, y, col.width, col.align);
      x += col.width;
    }
    y += 16;
    doc.moveTo(startX, y).lineTo(startX + tableWidth, y).strokeColor("#ccc").stroke();
    y += 4;
  };

  drawHeader();

  for (const row of rows) {
    if (y > doc.page.height - doc.page.margins.bottom - 20) {
      doc.addPage();
      y = doc.page.margins.top;
      drawHeader();
    }

    let x = startX;
    doc.fontSize(8).fillColor("#111");
    for (const col of columns) {
      drawText(doc, col.value(row), x, y, col.width, col.align);
      x += col.width;
    }
    y += 16;
  }

  doc.moveTo(startX, y).lineTo(startX + tableWidth, y).strokeColor("#ccc").stroke();
  y += 8;
  doc.fontSize(10).fillColor("#000");
  if (footer) drawText(doc, footer(rows), startX, y, tableWidth, "right");

  doc.end();
  return done;
}
