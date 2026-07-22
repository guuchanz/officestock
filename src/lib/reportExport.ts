import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import path from "path";
import type { TransactionDetailRow } from "@/actions/report.actions";

// Plain WOFF, not WOFF2: fontkit's WOFF2 subsetter throws
// "RangeError: Offset is outside the bounds of the DataView" on certain Thai
// composite glyphs (e.g. any string containing แ, U+0E41), which aborts PDF
// generation before the response is written. The WOFF1 build of the same
// font doesn't hit that subsetting bug.
const THAI_FONT = path.join(
  process.cwd(),
  "node_modules/@fontsource/sarabun/files/sarabun-thai-400-normal.woff"
);

export async function buildExcelReport(sheetName: string, rows: TransactionDetailRow[]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);

  sheet.columns = [
    { header: "Date",         key: "date",      width: 14 },
    { header: "Type",         key: "type",      width: 10 },
    { header: "Product Code", key: "code",      width: 14 },
    { header: "Product Name", key: "name",      width: 30 },
    { header: "Quantity",     key: "quantity",  width: 10 },
    { header: "Unit",         key: "unit",      width: 10 },
    { header: "Unit Price",   key: "unitPrice", width: 14 },
    { header: "Cost",         key: "cost",      width: 14 },
    { header: "Reason",       key: "reason",    width: 18 },
    { header: "Receiver",     key: "receiver",  width: 16 },
    { header: "Note",         key: "note",      width: 20 },
    { header: "Operator",     key: "operator",  width: 20 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const r of rows) {
    sheet.addRow({
      date:      r.createdAt.toLocaleDateString("th-TH"),
      type:      r.type === "IN" ? "นำเข้า" : "เบิกออก",
      code:      r.productCode,
      name:      r.productName,
      quantity:  r.type === "IN" ? r.quantity : -r.quantity,
      unit:      r.unit ?? "ชิ้น",
      unitPrice: r.unitPrice,
      cost:      r.cost,
      reason:    r.reason,
      receiver:  r.receiver ?? "",
      note:      r.note ?? "",
      operator:  r.operator,
    });
  }

  sheet.getColumn("unitPrice").numFmt = "#,##0.00";
  sheet.getColumn("cost").numFmt = "#,##0.00";

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

export async function buildPdfReport(title: string, rows: TransactionDetailRow[]) {
  const doc = new PDFDocument({ margin: 36, size: "A4", layout: "landscape" });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  doc.registerFont("thai", THAI_FONT);

  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  doc.fontSize(16);
  drawText(doc, title, doc.page.margins.left, doc.y, pageWidth, "center");
  doc.moveDown(1.5);

  const columns = [
    { key: "date",      label: "Date",        width: 60,  align: "left" as const },
    { key: "type",      label: "Type",        width: 45,  align: "center" as const },
    { key: "code",      label: "Code",        width: 55,  align: "left" as const },
    { key: "name",      label: "Product Name", width: 130, align: "left" as const },
    { key: "quantity",  label: "Quantity",    width: 45,  align: "right" as const },
    { key: "unitPrice", label: "Unit Price",  width: 65,  align: "right" as const },
    { key: "cost",      label: "Cost",        width: 70,  align: "right" as const },
    { key: "receiver",  label: "Receiver",    width: 80,  align: "left" as const },
    { key: "operator",  label: "Operator",    width: 90,  align: "left" as const },
  ];

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

  let totalCost = 0;
  for (const r of rows) {
    if (y > doc.page.height - doc.page.margins.bottom - 20) {
      doc.addPage();
      y = doc.page.margins.top;
      drawHeader();
    }

    const values: Record<string, string> = {
      date:      r.createdAt.toLocaleDateString("th-TH"),
      type:      r.type === "IN" ? "นำเข้า" : "เบิกออก",
      code:      r.productCode,
      name:      r.productName,
      quantity:  `${r.type === "IN" ? "+" : "-"}${r.quantity} ${r.unit ?? "ชิ้น"}`,
      unitPrice: r.unitPrice.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      cost:      r.cost.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      receiver:  r.receiver ?? "-",
      operator:  r.operator,
    };

    let x = startX;
    doc.fontSize(8).fillColor("#111");
    for (const col of columns) {
      drawText(doc, values[col.key], x, y, col.width, col.align);
      x += col.width;
    }
    y += 16;
    totalCost += r.cost;
  }

  doc.moveTo(startX, y).lineTo(startX + tableWidth, y).strokeColor("#ccc").stroke();
  y += 8;
  doc.fontSize(10).fillColor("#000");
  drawText(
    doc,
    `Total: ${totalCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} THB`,
    startX,
    y,
    tableWidth,
    "right"
  );

  doc.end();
  return done;
}
