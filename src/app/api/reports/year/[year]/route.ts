import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getYearTransactionDetails } from "@/actions/report.actions";
import { buildExcelReport, buildPdfReport } from "@/lib/reportExport";

export const runtime = "nodejs";

const YEAR_RE = /^\d{4}$/;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ year: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { year } = await params;
  if (!YEAR_RE.test(year)) {
    return NextResponse.json({ message: "รูปแบบปีไม่ถูกต้อง" }, { status: 400 });
  }

  const format = req.nextUrl.searchParams.get("format");
  const rows = await getYearTransactionDetails(year);

  if (format === "excel") {
    const buffer = await buildExcelReport(`รายงาน ${year}`, rows);
    return new NextResponse(buffer as any, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="report-year-${year}.xlsx"`,
      },
    });
  }

  if (format === "pdf") {
    const buffer = await buildPdfReport(`Stock Transaction Report - Year ${year}`, rows);
    return new NextResponse(buffer as any, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="report-year-${year}.pdf"`,
      },
    });
  }

  return NextResponse.json({ message: "รูปแบบไฟล์ไม่ถูกต้อง" }, { status: 400 });
}
