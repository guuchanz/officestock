import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getMonthTransactionDetails } from "@/actions/report.actions";
import { buildExcelReport, buildPdfReport } from "@/lib/reportExport";
import {
  TRANSACTION_EXCEL_COLUMNS, TRANSACTION_PDF_COLUMNS, transactionFooter,
} from "@/lib/reportColumns";

export const runtime = "nodejs";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function monthLabel(month: string) {
  const [year, monthNum] = month.split("-").map(Number);
  return new Date(year, monthNum - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year:  "numeric",
  });
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
    const buffer = await buildExcelReport(`รายงาน ${month}`, TRANSACTION_EXCEL_COLUMNS, rows);
    return new NextResponse(buffer as any, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="report-${month}.xlsx"`,
      },
    });
  }

  if (format === "pdf") {
    const buffer = await buildPdfReport(`Stock Transaction Report - ${monthLabel(month)}`, TRANSACTION_PDF_COLUMNS, rows, transactionFooter);
    return new NextResponse(buffer as any, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="report-${month}.pdf"`,
      },
    });
  }

  return NextResponse.json({ message: "รูปแบบไฟล์ไม่ถูกต้อง" }, { status: 400 });
}
