/**
 * Shared maintenance helpers and constants.
 *
 * Lives here rather than in `equipment.actions.ts` because a `"use server"`
 * module may only export async functions — the same reason
 * `repair-constants.ts` exists.
 */

/** An asset due within this many days counts as "due soon" (amber). */
export const DUE_SOON_DAYS = 30;

/** Interval presets offered as buttons on the form. Any 1-120 value is legal. */
export const INTERVAL_PRESETS = [1, 3, 6, 12] as const;

export const MIN_INTERVAL_MONTHS = 1;
export const MAX_INTERVAL_MONTHS = 120;

export type DueBucket = "OVERDUE" | "DUE_SOON" | "SCHEDULED" | "INACTIVE";

/**
 * Adds whole months, clamping to the last day of the target month.
 *
 * `Date.setMonth` alone rolls over — 31 Jan + 1 month gives 3 March — which
 * would push a month-end cycle a few days further out on every single
 * service. Clamping keeps 31 Jan + 1 month on 28 Feb.
 */
export function addMonths(from: Date, months: number): Date {
  const d = new Date(from);
  const targetDay = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(targetDay, lastDay));
  return d;
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Whole days from today until `nextDueAt`. Negative means overdue.
 *
 * Both sides are normalised to local midnight first, so an asset due later
 * today reads 0 ("due today") rather than -1.
 */
export function remainingDays(nextDueAt: Date, now: Date = new Date()): number {
  const a = startOfDay(now).getTime();
  const b = startOfDay(nextDueAt).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** The one scheduling rule: next due = last service (or baseline) + interval. */
export function computeNextDue(
  baselineAt: Date,
  lastDoneAt: Date | null,
  intervalMonths: number
): Date {
  return addMonths(lastDoneAt ?? baselineAt, intervalMonths);
}

export function bucketFor(
  nextDueAt: Date,
  isActive: boolean,
  now: Date = new Date()
): DueBucket {
  if (!isActive) return "INACTIVE";
  const days = remainingDays(nextDueAt, now);
  if (days < 0) return "OVERDUE";
  if (days <= DUE_SOON_DAYS) return "DUE_SOON";
  return "SCHEDULED";
}
