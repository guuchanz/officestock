"use server";

import { ProjectStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ProjectReportRow = {
  code: string;
  name: string;
  department: string;
  requestor: string;
  owner: string;
  status: ProjectStatus;
  priority: string;
  startDate: Date;
  dueDate: Date | null;
  finishedAt: Date | null;
  /** Positive = late. Null when there is nothing to measure against. */
  daysLate: number | null;
  budget: number;
  actualCost: number;
  variance: number;
};

const DAY = 24 * 60 * 60 * 1000;

/**
 * `daysLate` is finishedAt - dueDate for finished projects, today - dueDate
 * for unfinished ones already past due, and null otherwise.
 */
function daysLate(dueDate: Date | null, finishedAt: Date | null, today: Date): number | null {
  if (!dueDate) return null;
  const end = finishedAt ?? today;
  const diff = Math.round((end.getTime() - dueDate.getTime()) / DAY);
  if (!finishedAt && diff <= 0) return null;
  return diff;
}

export async function getProjectReport(
  year: number,
  status?: string
): Promise<{ rows: ProjectReportRow[] }> {
  const from = new Date(year, 0, 1);
  const to = new Date(year + 1, 0, 1);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const where: any = { startDate: { gte: from, lt: to } };
  if (status && status in ProjectStatus) where.status = status as ProjectStatus;

  const projects = await prisma.project.findMany({
    where,
    orderBy: { startDate: "asc" },
    include: {
      department: { select: { name: true } },
      owner:      { select: { name: true, email: true } },
    },
  });

  const rows = projects.map((p) => {
    const budget = Number(p.budget);
    const actualCost = Number(p.actualCost);
    return {
      code: p.code,
      name: p.name,
      department: p.department?.name ?? "-",
      requestor: p.requestor ?? "-",
      owner: p.owner?.name ?? p.owner?.email ?? "-",
      status: p.status,
      priority: p.priority,
      startDate: p.startDate,
      dueDate: p.dueDate,
      finishedAt: p.finishedAt,
      daysLate: daysLate(p.dueDate, p.finishedAt, today),
      budget,
      actualCost,
      variance: budget - actualCost,
    };
  });

  return { rows };
}
