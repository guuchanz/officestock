import { RepairStatus } from "@prisma/client";

/**
 * An open job older than this many days counts as overdue on the dashboard.
 *
 * Lives here rather than in `repair.actions.ts` because a `"use server"` module
 * may only export async functions.
 */
export const OVERDUE_DAYS = 7;

/** Statuses that mean the job is still being worked on. */
export const OPEN_STATUSES: RepairStatus[] = [
  RepairStatus.RECEIVED,
  RepairStatus.IN_PROGRESS,
  RepairStatus.DONE,
];

/** Statuses that mean the job is finished; `closedAt` is set for these. */
export const CLOSED_STATUSES: RepairStatus[] = [
  RepairStatus.RETURNED,
  RepairStatus.CANCELLED,
];

/** Legal moves. Backwards moves between open states are allowed (failed retest). */
export const TRANSITIONS: Record<RepairStatus, RepairStatus[]> = {
  RECEIVED:    [RepairStatus.IN_PROGRESS, RepairStatus.CANCELLED],
  IN_PROGRESS: [RepairStatus.RECEIVED, RepairStatus.DONE, RepairStatus.CANCELLED],
  DONE:        [RepairStatus.IN_PROGRESS, RepairStatus.RETURNED, RepairStatus.CANCELLED],
  RETURNED:    [RepairStatus.DONE],
  CANCELLED:   [RepairStatus.RECEIVED],
};
