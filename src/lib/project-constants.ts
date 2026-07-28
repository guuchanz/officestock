import { ProjectStatus, ProjectPriority } from "@prisma/client";

/**
 * Lives here rather than in `project.actions.ts` because a `"use server"`
 * module may only export async functions, and Client Components import
 * these lists to build dropdowns.
 */

/** A project past its due date by more than this many days is "overdue". */
export const OVERDUE_GRACE_DAYS = 0;

/** Order used by every status dropdown and report grouping. */
export const PROJECT_STATUSES: ProjectStatus[] = [
  ProjectStatus.PLANNING,
  ProjectStatus.IN_PROGRESS,
  ProjectStatus.ON_HOLD,
  ProjectStatus.DONE,
  ProjectStatus.CANCELLED,
];

export const PROJECT_PRIORITIES: ProjectPriority[] = [
  ProjectPriority.LOW,
  ProjectPriority.MEDIUM,
  ProjectPriority.HIGH,
];

/** Statuses that mean the project is still live. */
export const OPEN_STATUSES: ProjectStatus[] = [
  ProjectStatus.PLANNING,
  ProjectStatus.IN_PROGRESS,
  ProjectStatus.ON_HOLD,
];

/**
 * Legal moves. CANCELLED is terminal; DONE can be reopened to IN_PROGRESS,
 * which clears `finishedAt`.
 */
export const TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  PLANNING:    [ProjectStatus.IN_PROGRESS, ProjectStatus.CANCELLED],
  IN_PROGRESS: [ProjectStatus.ON_HOLD, ProjectStatus.DONE, ProjectStatus.CANCELLED],
  ON_HOLD:     [ProjectStatus.IN_PROGRESS, ProjectStatus.CANCELLED],
  DONE:        [ProjectStatus.IN_PROGRESS],
  CANCELLED:   [],
};
