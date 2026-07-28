import { Prisma } from "@prisma/client";

/**
 * Server-only helpers for the Project module. Not a `"use server"` module —
 * these are called from actions, never from the client, and `recalcProject`
 * must accept a transaction client, which a Server Action cannot.
 */

/** Rounds to 2 decimals without float drift on the last digit. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Normalises a date to local midnight. `startDate` and `dueDate` are
 * conceptually dates, not instants; without this a bar rendered from a
 * 17:00 +07 timestamp lands on the previous day once converted to UTC.
 * Matches `src/lib/maintenance-constants.ts:39`.
 */
export function dateOnly(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * `PJ-YYYY-NNN`, sequence restarting each calendar year. Same shape as
 * `jobNumber` in `repair.actions.ts:123-129`: read the newest code sharing
 * this year's prefix, parse the numeric tail, increment, pad to 3.
 *
 * Must be called inside the same transaction as the insert, or two
 * simultaneous creates can both read the same "latest" row.
 */
export async function nextProjectCode(
  tx: Prisma.TransactionClient,
  year: number
): Promise<string> {
  const prefix = `PJ-${year}-`;
  const latest = await tx.project.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  const seq = latest ? Number(latest.code.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq).padStart(3, "0")}`;
}

/**
 * Rewrites the two derived columns from their sources.
 *
 * Takes a transaction client rather than the global `prisma` so it runs
 * inside the mutation that invalidated the values — otherwise a rolled-back
 * milestone insert leaves `progress` describing rows that no longer exist.
 *
 * A project with no milestones is 0%, not 100%: an empty plan is not a
 * finished project.
 */
export async function recalcProject(
  tx: Prisma.TransactionClient,
  projectId: number
): Promise<void> {
  const [total, done, costAgg] = await Promise.all([
    tx.projectMilestone.count({ where: { projectId } }),
    tx.projectMilestone.count({ where: { projectId, isDone: true } }),
    tx.projectUpdate.aggregate({ where: { projectId }, _sum: { cost: true } }),
  ]);

  const progress = total === 0 ? 0 : Math.round((done / total) * 100);
  const actualCost = round2(Number(costAgg._sum.cost ?? 0));

  await tx.project.update({
    where: { id: projectId },
    data: { progress, actualCost },
  });
}
