import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getProjectReport } from "@/actions/projectReport.actions";
import { buildExcelReport } from "@/lib/reportExport";
import { PROJECT_EXCEL_COLUMNS } from "@/lib/reportColumns";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const year = Number(sp.get("year"));
  const status = sp.get("status") ?? undefined;

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ message: "ปีไม่ถูกต้อง" }, { status: 400 });
  }
  if (sp.get("format") !== "excel") {
    return NextResponse.json({ message: "รูปแบบไฟล์ไม่ถูกต้อง" }, { status: 400 });
  }

  const { rows } = await getProjectReport(year, status);
  const buffer = await buildExcelReport(`รายงานโครงการ ${year}`, PROJECT_EXCEL_COLUMNS, rows);

  return new NextResponse(buffer as any, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="project-report-${year}.xlsx"`,
    },
  });
}
