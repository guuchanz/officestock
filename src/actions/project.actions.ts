"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { ProjectStatus, ProjectPriority } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { dateOnly, nextProjectCode } from "@/lib/projects";
import { TRANSITIONS, OPEN_STATUSES } from "@/lib/project-constants";

export type ProjectActionState = {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
};

async function buildProjectSchema() {
  const t = await getTranslations("ProjectActions");
  return z
    .object({
      name:         z.string().min(1, t("nameRequired")),
      details:      z.string().optional(),
      departmentId: z.number().int().positive().optional(),
      requestor:    z.string().optional(),
      status:       z.nativeEnum(ProjectStatus),
      priority:     z.nativeEnum(ProjectPriority),
      atRisk:       z.boolean(),
      startDate:    z.coerce.date({ errorMap: () => ({ message: t("startDateRequired") }) }),
      dueDate:      z.coerce.date().optional(),
      budget:       z.number().min(0, t("budgetInvalid")),
    })
    .superRefine((data, ctx) => {
      if (data.dueDate && data.dueDate < data.startDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["dueDate"],
          message: t("dueBeforeStart"),
        });
      }
    });
}

function readProjectForm(formData: FormData) {
  const num = (k: string) => {
    const v = formData.get(k);
    return v === null || v === "" ? undefined : Number(v);
  };
  const str = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
  };
  return {
    name:         formData.get("name") ?? "",
    details:      str("details"),
    departmentId: num("departmentId"),
    requestor:    str("requestor"),
    status:       formData.get("status") ?? ProjectStatus.PLANNING,
    priority:     formData.get("priority") ?? ProjectPriority.MEDIUM,
    atRisk:       formData.get("atRisk") === "on",
    startDate:    formData.get("startDate") ?? "",
    dueDate:      str("dueDate"),
    budget:       num("budget") ?? 0,
  };
}

export async function createProjectAction(
  _prev: ProjectActionState,
  formData: FormData
): Promise<ProjectActionState> {
  const session = await auth();
  const t = await getTranslations("ProjectActions");
  const userId = session?.user?.id;
  if (!userId) return { success: false, message: t("loginRequired") };

  const schema = await buildProjectSchema();
  const parsed = schema.safeParse(readProjectForm(formData));
  if (!parsed.success) {
    return {
      success: false,
      message: t("invalidData"),
      errors: parsed.error.flatten().fieldErrors,
    };
  }
  const d = parsed.data;

  await prisma.$transaction(async (tx) => {
    const code = await nextProjectCode(tx, d.startDate.getFullYear());
    await tx.project.create({
      data: {
        code,
        name:         d.name,
        details:      d.details ?? null,
        departmentId: d.departmentId ?? null,
        requestor:    d.requestor ?? null,
        // Owner is always the signed-in user; there is no form field for it.
        ownerId:      userId,
        status:       d.status,
        priority:     d.priority,
        atRisk:       d.atRisk,
        startDate:    dateOnly(d.startDate),
        dueDate:      d.dueDate ? dateOnly(d.dueDate) : null,
        finishedAt:   d.status === ProjectStatus.DONE ? new Date() : null,
        budget:       d.budget,
        createdById:  userId,
      },
    });
  });

  revalidatePath("/projects");
  revalidatePath("/projects/overview");
  return { success: true, message: t("createSuccess") };
}

export async function updateProjectAction(
  id: number,
  _prev: ProjectActionState,
  formData: FormData
): Promise<ProjectActionState> {
  const session = await auth();
  const t = await getTranslations("ProjectActions");
  if (!session?.user) return { success: false, message: t("loginRequired") };

  const schema = await buildProjectSchema();
  const parsed = schema.safeParse(readProjectForm(formData));
  if (!parsed.success) {
    return {
      success: false,
      message: t("invalidData"),
      errors: parsed.error.flatten().fieldErrors,
    };
  }
  const d = parsed.data;

  const existing = await prisma.project.findUnique({ where: { id } });
  if (!existing) return { success: false, message: t("notFound") };

  // The form may not change status; a status change made here still has to
  // keep finishedAt honest.
  const enteringDone = d.status === ProjectStatus.DONE && existing.status !== ProjectStatus.DONE;
  const leavingDone  = d.status !== ProjectStatus.DONE && existing.status === ProjectStatus.DONE;

  await prisma.project.update({
    where: { id },
    data: {
      name:         d.name,
      details:      d.details ?? null,
      departmentId: d.departmentId ?? null,
      requestor:    d.requestor ?? null,
      // ownerId is deliberately absent: editing a project must not reassign
      // it to whoever happens to be editing.
      status:       d.status,
      priority:     d.priority,
      atRisk:       d.atRisk,
      startDate:    dateOnly(d.startDate),
      dueDate:      d.dueDate ? dateOnly(d.dueDate) : null,
      budget:       d.budget,
      ...(enteringDone ? { finishedAt: new Date() } : {}),
      ...(leavingDone ? { finishedAt: null } : {}),
    },
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  revalidatePath("/projects/overview");
  return { success: true, message: t("updateSuccess") };
}

/**
 * ADMIN only. Cascades to milestones, updates and attachments via the
 * schema's onDelete: Cascade — the uploaded files on disk are intentionally
 * left in place, matching how repair attachments behave.
 */
export async function deleteProjectAction(id: number): Promise<ProjectActionState> {
  const session = await auth();
  const t = await getTranslations("ProjectActions");
  if (!session?.user) return { success: false, message: t("loginRequired") };
  if ((session.user as any).role !== "ADMIN") {
    return { success: false, message: t("forbidden") };
  }

  const existing = await prisma.project.findUnique({ where: { id } });
  if (!existing) return { success: false, message: t("notFound") };

  await prisma.project.delete({ where: { id } });

  revalidatePath("/projects");
  revalidatePath("/projects/overview");
  return { success: true, message: t("deleteSuccess") };
}

export async function changeProjectStatusAction(
  id: number,
  status: ProjectStatus
): Promise<ProjectActionState> {
  const session = await auth();
  const t = await getTranslations("ProjectActions");
  if (!session?.user) return { success: false, message: t("loginRequired") };

  const existing = await prisma.project.findUnique({ where: { id } });
  if (!existing) return { success: false, message: t("notFound") };
  if (existing.status === status) return { success: true, message: t("updateSuccess") };
  if (!TRANSITIONS[existing.status].includes(status)) {
    return { success: false, message: t("illegalTransition") };
  }

  await prisma.project.update({
    where: { id },
    data: {
      status,
      // Entering DONE stamps the actual finish; leaving it clears it, so a
      // reopened project is not reported as delivered.
      finishedAt: status === ProjectStatus.DONE ? new Date() : null,
    },
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  revalidatePath("/projects/overview");
  return { success: true, message: t("updateSuccess") };
}

export async function toggleAtRiskAction(id: number): Promise<ProjectActionState> {
  const session = await auth();
  const t = await getTranslations("ProjectActions");
  if (!session?.user) return { success: false, message: t("loginRequired") };

  const existing = await prisma.project.findUnique({ where: { id } });
  if (!existing) return { success: false, message: t("notFound") };

  await prisma.project.update({
    where: { id },
    data: { atRisk: !existing.atRisk },
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  revalidatePath("/projects/overview");
  return { success: true, message: t("updateSuccess") };
}

export type ProjectListRow = {
  id: number;
  code: string;
  name: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  atRisk: boolean;
  progress: number;
  startDate: Date;
  dueDate: Date | null;
  finishedAt: Date | null;
  budget: number;
  actualCost: number;
  departmentName: string | null;
  requestor: string | null;
  ownerName: string | null;
};

export async function getProjects(filters: {
  q?: string;
  status?: string;
  priority?: string;
  departmentId?: string;
}): Promise<ProjectListRow[]> {
  const where: any = {};

  if (filters.q?.trim()) {
    const q = filters.q.trim();
    where.OR = [
      { name: { contains: q } },
      { code: { contains: q } },
      { details: { contains: q } },
    ];
  }
  if (filters.status && filters.status in ProjectStatus) {
    where.status = filters.status as ProjectStatus;
  }
  if (filters.priority && filters.priority in ProjectPriority) {
    where.priority = filters.priority as ProjectPriority;
  }
  const deptId = Number(filters.departmentId);
  if (Number.isInteger(deptId) && deptId > 0) where.departmentId = deptId;

  const rows = await prisma.project.findMany({
    where,
    orderBy: [{ atRisk: "desc" }, { startDate: "desc" }],
    include: {
      department: { select: { name: true } },
      owner:      { select: { name: true, email: true } },
    },
  });

  // Decimal must not cross into a Client Component.
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    status: r.status,
    priority: r.priority,
    atRisk: r.atRisk,
    progress: r.progress,
    startDate: r.startDate,
    dueDate: r.dueDate,
    finishedAt: r.finishedAt,
    budget: Number(r.budget),
    actualCost: Number(r.actualCost),
    departmentName: r.department?.name ?? null,
    requestor: r.requestor,
    ownerName: r.owner?.name ?? r.owner?.email ?? null,
  }));
}

export type ProjectDetail = ProjectListRow & {
  details: string | null;
  departmentId: number | null;
  ownerId: string | null;
  milestones: {
    id: number; name: string; startDate: Date | null; endDate: Date | null;
    isDone: boolean; doneAt: Date | null; sortOrder: number;
  }[];
  updates: {
    id: number; note: string; cost: number; createdAt: Date; authorName: string;
    attachments: { id: number; docName: string; fileUrl: string; fileName: string }[];
  }[];
  files: { id: number; docName: string; fileUrl: string; fileName: string; createdAt: Date }[];
};

export async function getProject(id: number): Promise<ProjectDetail | null> {
  const r = await prisma.project.findUnique({
    where: { id },
    include: {
      department: { select: { name: true } },
      owner:      { select: { name: true, email: true } },
      milestones: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
      updates: {
        orderBy: { createdAt: "desc" },
        include: {
          createdBy:   { select: { name: true, email: true } },
          attachments: { select: { id: true, docName: true, fileUrl: true, fileName: true } },
        },
      },
      // Project-level documents only; per-update files come back nested above.
      attachments: {
        where: { updateId: null },
        orderBy: { createdAt: "desc" },
        select: { id: true, docName: true, fileUrl: true, fileName: true, createdAt: true },
      },
    },
  });
  if (!r) return null;

  return {
    id: r.id,
    code: r.code,
    name: r.name,
    details: r.details,
    status: r.status,
    priority: r.priority,
    atRisk: r.atRisk,
    progress: r.progress,
    startDate: r.startDate,
    dueDate: r.dueDate,
    finishedAt: r.finishedAt,
    budget: Number(r.budget),
    actualCost: Number(r.actualCost),
    departmentId: r.departmentId,
    departmentName: r.department?.name ?? null,
    requestor: r.requestor,
    ownerId: r.ownerId,
    ownerName: r.owner?.name ?? r.owner?.email ?? null,
    milestones: r.milestones.map((m) => ({
      id: m.id, name: m.name, startDate: m.startDate, endDate: m.endDate,
      isDone: m.isDone, doneAt: m.doneAt, sortOrder: m.sortOrder,
    })),
    updates: r.updates.map((u) => ({
      id: u.id,
      note: u.note,
      cost: Number(u.cost),
      createdAt: u.createdAt,
      authorName: u.createdBy.name ?? u.createdBy.email,
      attachments: u.attachments,
    })),
    files: r.attachments,
  };
}

export type ProjectStats = {
  open: number;
  overdue: number;
  atRisk: number;
  doneThisYear: number;
  budgetTotal: number;
  actualTotal: number;
};

export async function getProjectStats(): Promise<ProjectStats> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yearStart = new Date(today.getFullYear(), 0, 1);

  const [open, overdue, atRisk, doneThisYear, sums] = await Promise.all([
    prisma.project.count({ where: { status: { in: OPEN_STATUSES } } }),
    prisma.project.count({
      where: { status: { in: OPEN_STATUSES }, dueDate: { lt: today } },
    }),
    prisma.project.count({ where: { atRisk: true, status: { in: OPEN_STATUSES } } }),
    prisma.project.count({
      where: { status: ProjectStatus.DONE, finishedAt: { gte: yearStart } },
    }),
    prisma.project.aggregate({
      where: { status: { in: OPEN_STATUSES } },
      _sum: { budget: true, actualCost: true },
    }),
  ]);

  return {
    open,
    overdue,
    atRisk,
    doneThisYear,
    budgetTotal: Number(sums._sum.budget ?? 0),
    actualTotal: Number(sums._sum.actualCost ?? 0),
  };
}
