"use server";

import { RepairStatus, RepairType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface RepairReportRow {
  jobNumber:  string;
  reportedAt: Date;
  type:       RepairType;
  owner:      string;
  ownerName:  string;
  ownerTel:   string;
  deviceType: string;
  deviceName: string;
  deviceModel: string;
  serialNo:   string;
  serviceTag: string;
  expressNo:  string;
  problem:    string;
  technician: string;
  status:     RepairStatus;
  partsCost:  number;
  labourCost: number;
  totalCost:  number;
}

export interface RepairReportSummary {
  rows:         RepairReportRow[];
  totalJobs:    number;
  totalCost:    number;
  internalJobs: number;
  externalJobs: number;
  internalCost: number;
  externalCost: number;
}

/** `month` is 1-12. Omit it for a full-year report. */
export async function getRepairReport(year: number, month?: number): Promise<RepairReportSummary> {
  const start = month ? new Date(year, month - 1, 1) : new Date(year, 0, 1);
  const end   = month ? new Date(year, month, 1)     : new Date(year + 1, 0, 1);

  const jobs = await prisma.repairJob.findMany({
    where: { reportedAt: { gte: start, lt: end } },
    orderBy: { reportedAt: "asc" },
    include: {
      department: { select: { name: true } },
      technician: { select: { name: true } },
      deviceType: { select: { name: true } },
    },
  });

  const rows: RepairReportRow[] = jobs.map((j) => ({
    jobNumber:  j.jobNumber,
    reportedAt: j.reportedAt,
    type:       j.type,
    owner:       j.type === RepairType.INTERNAL ? j.department?.name ?? "-" : j.customerName ?? "-",
    ownerName:   j.ownerName ?? "-",
    ownerTel:    j.ownerTel ?? "-",
    deviceType:  j.deviceType?.name ?? "-",
    deviceName:  j.deviceName,
    deviceModel: j.deviceModel ?? "-",
    serialNo:    j.serialNo ?? "-",
    serviceTag:  j.serviceTag ?? "-",
    expressNo:   j.expressNo ?? "-",
    problem:     j.problem,
    technician: j.technician?.name ?? "-",
    status:     j.status,
    partsCost:  Number(j.partsCost),
    labourCost: Number(j.labourCost),
    totalCost:  Number(j.totalCost),
  }));

  const sumWhere = (pred: (r: RepairReportRow) => boolean) =>
    rows.filter(pred).reduce((s, r) => s + r.totalCost, 0);

  return {
    rows,
    totalJobs:    rows.length,
    totalCost:    rows.reduce((s, r) => s + r.totalCost, 0),
    internalJobs: rows.filter((r) => r.type === RepairType.INTERNAL).length,
    externalJobs: rows.filter((r) => r.type === RepairType.EXTERNAL).length,
    internalCost: sumWhere((r) => r.type === RepairType.INTERNAL),
    externalCost: sumWhere((r) => r.type === RepairType.EXTERNAL),
  };
}
