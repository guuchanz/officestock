"use server";

import { MaintResult } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { remainingDays, bucketFor, type DueBucket } from "@/lib/maintenance-constants";

export interface MaintHistoryRow {
  performedAt: Date;
  assetNo:     string;
  equipment:   string;
  factory:     string;
  area:        string;
  technician:  string;
  result:      MaintResult;
  partsUsed:   string;
  cost:        number;
  note:        string;
}

export interface MaintDueRow {
  assetNo:    string;
  equipment:  string;
  model:      string;
  serialNo:   string;
  factory:    string;
  area:       string;
  incharge:   string;
  interval:   number;
  lastDoneAt: Date | null;
  nextDueAt:  Date;
  remaining:  number;
  bucket:     DueBucket;
}

export interface MaintHistorySummary {
  rows:        MaintHistoryRow[];
  totalJobs:   number;
  totalCost:   number;
  byResult:    Record<MaintResult, number>;
}

/** `month` is 1-12. Omit it for a full-year report. */
export async function getMaintenanceHistory(
  year: number,
  month?: number
): Promise<MaintHistorySummary> {
  const start = month ? new Date(year, month - 1, 1) : new Date(year, 0, 1);
  const end   = month ? new Date(year, month, 1)     : new Date(year + 1, 0, 1);

  const logs = await prisma.maintenanceLog.findMany({
    where: { performedAt: { gte: start, lt: end } },
    orderBy: { performedAt: "asc" },
    include: {
      technician: { select: { name: true } },
      parts: { orderBy: { id: "asc" } },
      equipment: {
        select: {
          assetNo: true,
          name: true,
          factory: { select: { name: true } },
          area:    { select: { name: true } },
        },
      },
    },
  });

  const rows: MaintHistoryRow[] = logs.map((l) => ({
    performedAt: l.performedAt,
    assetNo:     l.equipment.assetNo,
    equipment:   l.equipment.name,
    factory:     l.equipment.factory?.name ?? "-",
    area:        l.equipment.area?.name ?? "-",
    technician:  l.technician?.name ?? "-",
    result:      l.result,
    // Falls back to the legacy free-text field for logs recorded before the
    // parts table existed.
    partsUsed:   l.parts.length
      ? l.parts.map((p) => `${p.name} (${Number(p.cost).toLocaleString("th-TH")})`).join(", ")
      : l.partsUsed ?? "-",
    cost:        Number(l.cost),
    note:        l.note ?? "-",
  }));

  const byResult = Object.fromEntries(
    Object.values(MaintResult).map((r) => [r, 0])
  ) as Record<MaintResult, number>;
  for (const r of rows) byResult[r.result]++;

  return {
    rows,
    totalJobs: rows.length,
    totalCost: rows.reduce((s, r) => s + r.cost, 0),
    byResult,
  };
}

/** Current snapshot of every active asset, most urgent first. */
export async function getMaintenanceDue(): Promise<MaintDueRow[]> {
  const rows = await prisma.equipment.findMany({
    where: { isActive: true },
    orderBy: { nextDueAt: "asc" },
    include: {
      factory:    { select: { name: true } },
      area:       { select: { name: true } },
      technician: { select: { name: true } },
    },
  });

  const now = new Date();
  return rows.map((e) => ({
    assetNo:    e.assetNo,
    equipment:  e.name,
    model:      e.model ?? "-",
    serialNo:   e.serialNo ?? "-",
    factory:    e.factory?.name ?? "-",
    area:       e.area?.name ?? "-",
    incharge:   e.technician?.name ?? "-",
    interval:   e.intervalMonths,
    lastDoneAt: e.lastDoneAt,
    nextDueAt:  e.nextDueAt,
    remaining:  remainingDays(e.nextDueAt, now),
    bucket:     bucketFor(e.nextDueAt, e.isActive, now),
  }));
}
