import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getMaintenanceHistory, getMaintenanceDue } from "@/actions/maintenanceReport.actions";
import { buildExcelReport, buildPdfReport } from "@/lib/reportExport";
import {
  MAINT_HISTORY_EXCEL_COLUMNS, MAINT_HISTORY_PDF_COLUMNS, maintHistoryFooter,
  MAINT_DUE_EXCEL_COLUMNS, MAINT_DUE_PDF_COLUMNS, maintDueFooter,
} from "@/lib/reportColumns";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const format = sp.get("format");
  const kind = sp.get("kind") ?? "history";

  if (format !== "excel" && format !== "pdf") {
    return NextResponse.json({ message: "รูปแบบไฟล์ไม่ถูกต้อง" }, { status: 400 });
  }

  // The due snapshot is "right now" by definition, so it ignores year/month.
  if (kind === "due") {
    const rows = await getMaintenanceDue();
    const label = new Date().toISOString().slice(0, 10);

    if (format === "excel") {
      const buffer = await buildExcelReport(`แผนบำรุงรักษา ${label}`, MAINT_DUE_EXCEL_COLUMNS, rows);
      return new NextResponse(buffer as any, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="maintenance-due-${label}.xlsx"`,
        },
      });
    }

    const buffer = await buildPdfReport(
      `Maintenance Due List - ${label}`, MAINT_DUE_PDF_COLUMNS, rows, maintDueFooter
    );
    return new NextResponse(buffer as any, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="maintenance-due-${label}.pdf"`,
      },
    });
  }

  const year = Number(sp.get("year"));
  const monthRaw = sp.get("month");
  const month = monthRaw ? Number(monthRaw) : undefined;

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ message: "ปีไม่ถูกต้อง" }, { status: 400 });
  }
  if (month !== undefined && (!Number.isInteger(month) || month < 1 || month > 12)) {
    return NextResponse.json({ message: "เดือนไม่ถูกต้อง" }, { status: 400 });
  }

  const { rows } = await getMaintenanceHistory(year, month);
  const label = month ? `${year}-${String(month).padStart(2, "0")}` : String(year);

  if (format === "excel") {
    const buffer = await buildExcelReport(
      `ประวัติบำรุงรักษา ${label}`, MAINT_HISTORY_EXCEL_COLUMNS, rows
    );
    return new NextResponse(buffer as any, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="maintenance-history-${label}.xlsx"`,
      },
    });
  }

  const buffer = await buildPdfReport(
    `Maintenance History - ${label}`, MAINT_HISTORY_PDF_COLUMNS, rows, maintHistoryFooter
  );
  return new NextResponse(buffer as any, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="maintenance-history-${label}.pdf"`,
    },
  });
}
