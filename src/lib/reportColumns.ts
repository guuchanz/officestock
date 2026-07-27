import type { TransactionDetailRow } from "@/actions/report.actions";
import type { ExcelColumn, PdfColumn } from "./reportExport";
import type { RepairReportRow } from "@/actions/repairReport.actions";
import type { MaintHistoryRow, MaintDueRow } from "@/actions/maintenanceReport.actions";

const money = (n: number) =>
  n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Reproduces the layout that was previously hard-coded in buildExcelReport. */
export const TRANSACTION_EXCEL_COLUMNS: ExcelColumn<TransactionDetailRow>[] = [
  { header: "Date",         key: "date",      width: 14, value: (r) => r.createdAt.toLocaleDateString("th-TH") },
  { header: "Type",         key: "type",      width: 10, value: (r) => (r.type === "IN" ? "นำเข้า" : "เบิกออก") },
  { header: "Product Code", key: "code",      width: 14, value: (r) => r.productCode },
  { header: "Product Name", key: "name",      width: 30, value: (r) => r.productName },
  { header: "Quantity",     key: "quantity",  width: 10, value: (r) => (r.type === "IN" ? r.quantity : -r.quantity) },
  { header: "Unit",         key: "unit",      width: 10, value: (r) => r.unit ?? "ชิ้น" },
  { header: "Unit Price",   key: "unitPrice", width: 14, numFmt: "#,##0.00", value: (r) => r.unitPrice },
  { header: "Cost",         key: "cost",      width: 14, numFmt: "#,##0.00", value: (r) => r.cost },
  { header: "Reason",       key: "reason",    width: 18, value: (r) => r.reason },
  { header: "Receiver",     key: "receiver",  width: 16, value: (r) => r.receiver ?? "" },
  { header: "Note",         key: "note",      width: 20, value: (r) => r.note ?? "" },
  { header: "Operator",     key: "operator",  width: 20, value: (r) => r.operator },
];

/** Reproduces the layout that was previously hard-coded in buildPdfReport. */
export const TRANSACTION_PDF_COLUMNS: PdfColumn<TransactionDetailRow>[] = [
  { label: "Date",         width: 60,  align: "left",   value: (r) => r.createdAt.toLocaleDateString("th-TH") },
  { label: "Type",         width: 45,  align: "center", value: (r) => (r.type === "IN" ? "นำเข้า" : "เบิกออก") },
  { label: "Code",         width: 55,  align: "left",   value: (r) => r.productCode },
  { label: "Product Name", width: 130, align: "left",   value: (r) => r.productName },
  { label: "Quantity",     width: 45,  align: "right",  value: (r) => `${r.type === "IN" ? "+" : "-"}${r.quantity} ${r.unit ?? "ชิ้น"}` },
  { label: "Unit Price",   width: 65,  align: "right",  value: (r) => money(r.unitPrice) },
  { label: "Cost",         width: 70,  align: "right",  value: (r) => money(r.cost) },
  { label: "Receiver",     width: 80,  align: "left",   value: (r) => r.receiver ?? "-" },
  { label: "Operator",     width: 90,  align: "left",   value: (r) => r.operator },
];

export function transactionFooter(rows: TransactionDetailRow[]) {
  const total = rows.reduce((s, r) => s + r.cost, 0);
  return `Total: ${total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} THB`;
}

// ---------------------------------------------------------------------------
// Repair reports
// ---------------------------------------------------------------------------

export const REPAIR_EXCEL_COLUMNS: ExcelColumn<RepairReportRow>[] = [
  { header: "Job No.",     key: "jobNumber",  width: 16, value: (r) => r.jobNumber },
  { header: "Reported",    key: "reportedAt", width: 14, value: (r) => r.reportedAt.toLocaleDateString("th-TH") },
  { header: "Type",        key: "type",       width: 12, value: (r) => (r.type === "INTERNAL" ? "ภายใน" : "ภายนอก") },
  { header: "Reported by", key: "owner",      width: 22, value: (r) => r.owner },
  { header: "Owner",       key: "ownerName",  width: 20, value: (r) => r.ownerName },
  { header: "Tel",         key: "ownerTel",   width: 16, value: (r) => r.ownerTel },
  { header: "Device Type", key: "deviceType", width: 14, value: (r) => r.deviceType },
  { header: "Device",      key: "device",     width: 28, value: (r) => r.deviceName },
  { header: "Model",       key: "deviceModel", width: 20, value: (r) => r.deviceModel },
  { header: "Assets No",   key: "serialNo",   width: 20, value: (r) => r.serialNo },
  { header: "Service Tag", key: "serviceTag", width: 16, value: (r) => r.serviceTag },
  { header: "Express No.", key: "expressNo",  width: 18, value: (r) => r.expressNo },
  { header: "Problem",     key: "problem",    width: 34, value: (r) => r.problem },
  { header: "Technician",  key: "technician", width: 20, value: (r) => r.technician },
  { header: "Status",      key: "status",     width: 14, value: (r) => r.status },
  { header: "Parts Cost",  key: "partsCost",  width: 14, numFmt: "#,##0.00", value: (r) => r.partsCost },
  { header: "Labour Cost", key: "labourCost", width: 14, numFmt: "#,##0.00", value: (r) => r.labourCost },
  { header: "Total Cost",  key: "totalCost",  width: 14, numFmt: "#,##0.00", value: (r) => r.totalCost },
];

// Widths sum to 765pt, inside the 770pt landscape A4 content width.
// The PDF carries fewer columns than the Excel sheet on purpose — the full
// identifier set only fits legibly in the spreadsheet.
export const REPAIR_PDF_COLUMNS: PdfColumn<RepairReportRow>[] = [
  { label: "Job No.",     width: 72,  align: "left",   value: (r) => r.jobNumber },
  { label: "Reported",    width: 55,  align: "left",   value: (r) => r.reportedAt.toLocaleDateString("th-TH") },
  { label: "Type",        width: 42,  align: "center", value: (r) => (r.type === "INTERNAL" ? "ภายใน" : "ภายนอก") },
  { label: "Device Type", width: 52,  align: "center", value: (r) => r.deviceType },
  { label: "Device",      width: 105, align: "left",   value: (r) => r.deviceName },
  { label: "Model",       width: 80,  align: "left",   value: (r) => r.deviceModel },
  { label: "Assets No",   width: 85,  align: "left",   value: (r) => r.serialNo },
  { label: "Owner",       width: 80,  align: "left",   value: (r) => r.ownerName },
  { label: "Technician",  width: 62,  align: "left",   value: (r) => r.technician },
  { label: "Status",      width: 62,  align: "center", value: (r) => r.status },
  { label: "Total",       width: 70,  align: "right",  value: (r) => money(r.totalCost) },
];

export function repairFooter(rows: RepairReportRow[]) {
  const total = rows.reduce((s, r) => s + r.totalCost, 0);
  return `Total: ${total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} THB`;
}

// ---------------------------------------------------------------------------
// Maintenance reports
// ---------------------------------------------------------------------------

const thDate = (d: Date | null) => (d ? d.toLocaleDateString("th-TH") : "-");

export const MAINT_HISTORY_EXCEL_COLUMNS: ExcelColumn<MaintHistoryRow>[] = [
  { header: "Date",       key: "performedAt", width: 14, value: (r) => thDate(r.performedAt) },
  { header: "Asset No.",  key: "assetNo",     width: 18, value: (r) => r.assetNo },
  { header: "Equipment",  key: "equipment",   width: 28, value: (r) => r.equipment },
  { header: "Factory",    key: "factory",     width: 18, value: (r) => r.factory },
  { header: "Area",       key: "area",        width: 18, value: (r) => r.area },
  { header: "Technician", key: "technician",  width: 20, value: (r) => r.technician },
  { header: "Result",     key: "result",      width: 14, value: (r) => r.result },
  { header: "Parts Used", key: "partsUsed",   width: 30, value: (r) => r.partsUsed },
  { header: "Cost",       key: "cost",        width: 14, numFmt: "#,##0.00", value: (r) => r.cost },
  { header: "Note",       key: "note",        width: 30, value: (r) => r.note },
];

// Widths sum to 762pt, inside the 770pt landscape A4 content width.
export const MAINT_HISTORY_PDF_COLUMNS: PdfColumn<MaintHistoryRow>[] = [
  { label: "Date",       width: 62,  align: "left",   value: (r) => thDate(r.performedAt) },
  { label: "Asset No.",  width: 90,  align: "left",   value: (r) => r.assetNo },
  { label: "Equipment",  width: 140, align: "left",   value: (r) => r.equipment },
  { label: "Factory",    width: 85,  align: "left",   value: (r) => r.factory },
  { label: "Area",       width: 85,  align: "left",   value: (r) => r.area },
  { label: "Technician", width: 90,  align: "left",   value: (r) => r.technician },
  { label: "Result",     width: 70,  align: "center", value: (r) => r.result },
  { label: "Cost",       width: 70,  align: "right",  value: (r) => money(r.cost) },
];

export function maintHistoryFooter(rows: MaintHistoryRow[]) {
  const total = rows.reduce((s, r) => s + r.cost, 0);
  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.result] = (acc[r.result] ?? 0) + 1;
    return acc;
  }, {});
  const breakdown = Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join("  ");
  return `Services: ${rows.length}   ${breakdown}   Total: ${total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} THB`;
}

const remainingText = (r: MaintDueRow) =>
  r.remaining < 0 ? `${Math.abs(r.remaining)} overdue` : `${r.remaining}`;

export const MAINT_DUE_EXCEL_COLUMNS: ExcelColumn<MaintDueRow>[] = [
  { header: "Asset No.",  key: "assetNo",    width: 18, value: (r) => r.assetNo },
  { header: "Equipment",  key: "equipment",  width: 28, value: (r) => r.equipment },
  { header: "Model",      key: "model",      width: 20, value: (r) => r.model },
  { header: "Serial No.", key: "serialNo",   width: 20, value: (r) => r.serialNo },
  { header: "Factory",    key: "factory",    width: 18, value: (r) => r.factory },
  { header: "Area",       key: "area",       width: 18, value: (r) => r.area },
  { header: "In Charge",  key: "incharge",   width: 20, value: (r) => r.incharge },
  { header: "Interval",   key: "interval",   width: 12, value: (r) => `${r.interval} mo` },
  { header: "Last Done",  key: "lastDoneAt", width: 14, value: (r) => thDate(r.lastDoneAt) },
  { header: "Next Due",   key: "nextDueAt",  width: 14, value: (r) => thDate(r.nextDueAt) },
  { header: "Days Left",  key: "remaining",  width: 14, value: (r) => remainingText(r) },
  { header: "Status",     key: "bucket",     width: 14, value: (r) => r.bucket },
];

// Widths sum to 764pt.
export const MAINT_DUE_PDF_COLUMNS: PdfColumn<MaintDueRow>[] = [
  { label: "Asset No.", width: 90,  align: "left",   value: (r) => r.assetNo },
  { label: "Equipment", width: 130, align: "left",   value: (r) => r.equipment },
  { label: "Factory",   width: 80,  align: "left",   value: (r) => r.factory },
  { label: "Area",      width: 80,  align: "left",   value: (r) => r.area },
  { label: "In Charge", width: 84,  align: "left",   value: (r) => r.incharge },
  { label: "Interval",  width: 50,  align: "center", value: (r) => `${r.interval} mo` },
  { label: "Last Done", width: 60,  align: "left",   value: (r) => thDate(r.lastDoneAt) },
  { label: "Next Due",  width: 60,  align: "left",   value: (r) => thDate(r.nextDueAt) },
  { label: "Days Left", width: 60,  align: "right",  value: (r) => remainingText(r) },
  { label: "Status",    width: 70,  align: "center", value: (r) => r.bucket },
];

export function maintDueFooter(rows: MaintDueRow[]) {
  const overdue = rows.filter((r) => r.bucket === "OVERDUE").length;
  const soon = rows.filter((r) => r.bucket === "DUE_SOON").length;
  return `Equipment: ${rows.length}   Overdue: ${overdue}   Due soon: ${soon}`;
}
