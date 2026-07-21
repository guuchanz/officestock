import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { auth } from "@/lib/auth";
import { getAllTransactions } from "@/actions/product.actions";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const q = sp.get("q") ?? undefined;
  const from = sp.get("from") ?? undefined;
  const to = sp.get("to") ?? undefined;

  const items = await getAllTransactions({ q, from, to });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("ประวัติรายการ");

  sheet.columns = [
    { header: "วันที่",       key: "date",     width: 14 },
    { header: "เวลา",        key: "time",     width: 10 },
    { header: "ประเภท",      key: "type",     width: 10 },
    { header: "รหัสสินค้า",   key: "code",     width: 14 },
    { header: "ชื่อสินค้า",    key: "name",     width: 30 },
    { header: "จำนวน",       key: "quantity", width: 10 },
    { header: "เหตุผล",       key: "reason",     width: 18 },
    { header: "ผู้รับ",       key: "receiver",   width: 16 },
    { header: "แผนก",        key: "department", width: 18 },
    { header: "หมายเหตุ",     key: "note",       width: 20 },
    { header: "ผู้ทำรายการ",   key: "operator", width: 20 },
    { header: "อีเมล",       key: "email",    width: 24 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const tx of items) {
    sheet.addRow({
      date:      tx.createdAt.toLocaleDateString("th-TH"),
      time:      tx.createdAt.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
      type:      tx.type === "IN" ? "นำเข้า" : "เบิกออก",
      code:      tx.product.code,
      name:      tx.product.name,
      quantity:  tx.type === "IN" ? tx.quantity : -tx.quantity,
      reason:     tx.reason,
      receiver:   tx.receiver ?? "",
      department: tx.department?.name ?? "",
      note:       tx.note ?? "",
      operator:  tx.operator.name ?? "",
      email:     tx.operator.email,
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `transactions-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer as any, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
