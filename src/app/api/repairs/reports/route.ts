import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getRepairReport } from "@/actions/repairReport.actions";
import { buildExcelReport, buildPdfReport } from "@/lib/reportExport";
import {
  REPAIR_EXCEL_COLUMNS, REPAIR_PDF_COLUMNS, repairFooter,
} from "@/lib/reportColumns";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const year = Number(sp.get("year"));
  const monthRaw = sp.get("month");
  const month = monthRaw ? Number(monthRaw) : undefined;
  const format = sp.get("format");

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ message: "ปีไม่ถูกต้อง" }, { status: 400 });
  }
  if (month !== undefined && (!Number.isInteger(month) || month < 1 || month > 12)) {
    return NextResponse.json({ message: "เดือนไม่ถูกต้อง" }, { status: 400 });
  }

  const { rows } = await getRepairReport(year, month);
  const label = month ? `${year}-${String(month).padStart(2, "0")}` : String(year);

  if (format === "excel") {
    const buffer = await buildExcelReport(`รายงานงานซ่อม ${label}`, REPAIR_EXCEL_COLUMNS, rows);
    return new NextResponse(buffer as any, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="repair-report-${label}.xlsx"`,
      },
    });
  }

  if (format === "pdf") {
    const buffer = await buildPdfReport(`Repair Report - ${label}`, REPAIR_PDF_COLUMNS, rows, repairFooter);
    return new NextResponse(buffer as any, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="repair-report-${label}.pdf"`,
      },
    });
  }

  return NextResponse.json({ message: "รูปแบบไฟล์ไม่ถูกต้อง" }, { status: 400 });
}
