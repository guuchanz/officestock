import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import path from "path";
import { auth } from "@/lib/auth";
import { getMonthTransactionDetails } from "@/actions/report.actions";

export const runtime = "nodejs";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const THAI_FONT = path.join(
  process.cwd(),
  "node_modules/@fontsource/sarabun/files/sarabun-thai-400-normal.woff2"
);

function monthLabel(month: string) {
  const [year, monthNum] = month.split("-").map(Number);
  return new Date(year, monthNum - 1, 1).toLocaleDateString("th-TH", {
    month: "long",
    year:  "numeric",
  });
}

async function buildExcel(month: string, rows: Awaited<ReturnType<typeof getMonthTransactionDetails>>) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(`รายงาน ${month}`);

  sheet.columns = [
    { header: "วันที่",        key: "date",      width: 14 },
    { header: "ประเภท",       key: "type",      width: 10 },
    { header: "รหัสสินค้า",    key: "code",      width: 14 },
    { header: "ชื่อสินค้า",     key: "name",      width: 30 },
    { header: "จำนวน",        key: "quantity",  width: 10 },
    { header: "หน่วย",        key: "unit",      width: 10 },
    { header: "ราคาต่อหน่วย",  key: "unitPrice", width: 14 },
    { header: "มูลค่า",        key: "cost",      width: 14 },
    { header: "เหตุผล",        key: "reason",    width: 18 },
    { header: "ผู้รับ",        key: "receiver",  width: 16 },
    { header: "หมายเหตุ",      key: "note",      width: 20 },
    { header: "ผู้ทำรายการ",    key: "operator",  width: 20 },
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

async function buildPdf(month: string, rows: Awaited<ReturnType<typeof getMonthTransactionDetails>>) {
  const doc = new PDFDocument({ margin: 36, size: "A4", layout: "landscape" });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  doc.registerFont("thai", THAI_FONT);

  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  doc.fontSize(16);
  drawText(doc, `รายงานรายการสต็อกประจำเดือน ${monthLabel(month)}`, doc.page.margins.left, doc.y, pageWidth, "center");
  doc.moveDown(1.5);

  const columns = [
    { key: "date",      label: "วันที่",       width: 60,  align: "left" as const },
    { key: "type",      label: "ประเภท",      width: 45,  align: "center" as const },
    { key: "code",      label: "รหัส",         width: 55,  align: "left" as const },
    { key: "name",      label: "ชื่อสินค้า",     width: 130, align: "left" as const },
    { key: "quantity",  label: "จำนวน",       width: 45,  align: "right" as const },
    { key: "unitPrice", label: "ราคา/หน่วย",   width: 65,  align: "right" as const },
    { key: "cost",      label: "มูลค่า",        width: 70,  align: "right" as const },
    { key: "receiver",  label: "ผู้รับ",        width: 80,  align: "left" as const },
    { key: "operator",  label: "ผู้ทำรายการ",   width: 90,  align: "left" as const },
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
    `รวมมูลค่าทั้งหมด: ${totalCost.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท`,
    startX,
    y,
    tableWidth,
    "right"
  );

  doc.end();
  return done;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ month: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { month } = await params;
  if (!MONTH_RE.test(month)) {
    return NextResponse.json({ message: "รูปแบบเดือนไม่ถูกต้อง" }, { status: 400 });
  }

  const format = req.nextUrl.searchParams.get("format");
  const rows = await getMonthTransactionDetails(month);

  if (format === "excel") {
    const buffer = await buildExcel(month, rows);
    return new NextResponse(buffer as any, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="report-${month}.xlsx"`,
      },
    });
  }

  if (format === "pdf") {
    const buffer = await buildPdf(month, rows);
    return new NextResponse(buffer as any, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="report-${month}.pdf"`,
      },
    });
  }

  return NextResponse.json({ message: "รูปแบบไฟล์ไม่ถูกต้อง" }, { status: 400 });
}
