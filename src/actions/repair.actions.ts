"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { Prisma, RepairStatus, RepairType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { saveUpload } from "@/lib/uploads";
import {
  OVERDUE_DAYS, OPEN_STATUSES, CLOSED_STATUSES, TRANSITIONS,
} from "@/lib/repair-constants";

export type RepairActionState = {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
};

const EXT_FOR_MIME: Record<string, string> = {
  "image/png":       ".png",
  "image/jpeg":      ".jpg",
  "image/webp":      ".webp",
  "application/pdf": ".pdf",
};
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

class AttachmentError extends Error {}

async function buildRepairSchema() {
  const t = await getTranslations("RepairActions");
  return z
    .object({
      type:          z.nativeEnum(RepairType),
      departmentId:  z.number().int().positive().optional(),
      customerName:  z.string().optional(),
      customerPhone: z.string().optional(),
      ownerName:     z.string().optional(),
      ownerTel:      z.string().optional(),
      deviceTypeId:  z.number().int().positive().optional(),
      deviceName:    z.string().min(1, t("deviceNameRequired")),
      deviceModel:   z.string().optional(),
      serialNo:      z.string().optional(),
      serviceTag:    z.string().optional(),
      expressNo:     z.string().optional(),
      problem:       z.string().min(1, t("problemRequired")),
      partsUsed:     z.string().optional(),
      partsCost:     z.number().min(0, t("costInvalid")),
      labourCost:    z.number().min(0, t("costInvalid")),
      status:        z.nativeEnum(RepairStatus),
      technicianId:  z.number().int().positive().optional(),
      reportedAt:    z.coerce.date({ errorMap: () => ({ message: t("reportedAtRequired") }) }),
      note:          z.string().optional(),
    })
    .superRefine((data, ctx) => {
      if (data.type === RepairType.INTERNAL && !data.departmentId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["departmentId"], message: t("departmentRequired") });
      }
      if (data.type === RepairType.EXTERNAL && !data.customerName?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["customerName"], message: t("customerNameRequired") });
      }
    });
}

function readRepairForm(formData: FormData) {
  const num = (key: string) => {
    const raw = (formData.get(key) as string) || "";
    return raw ? Number(raw) : undefined;
  };
  const str = (key: string) => ((formData.get(key) as string) || "").trim() || undefined;

  return {
    type:          formData.get("type") as RepairType,
    departmentId:  num("departmentId"),
    customerName:  str("customerName"),
    customerPhone: str("customerPhone"),
    ownerName:     str("ownerName"),
    ownerTel:      str("ownerTel"),
    deviceTypeId:  num("deviceTypeId"),
    deviceName:    ((formData.get("deviceName") as string) ?? "").trim(),
    deviceModel:   str("deviceModel"),
    serialNo:      str("serialNo"),
    serviceTag:    str("serviceTag"),
    expressNo:     str("expressNo"),
    problem:       ((formData.get("problem") as string) ?? "").trim(),
    partsUsed:     str("partsUsed"),
    partsCost:     num("partsCost") ?? 0,
    labourCost:    num("labourCost") ?? 0,
    status:        (formData.get("status") as RepairStatus) || RepairStatus.RECEIVED,
    technicianId:  num("technicianId"),
    reportedAt:    (formData.get("reportedAt") as string) || new Date().toISOString().slice(0, 10),
    note:          str("note"),
  };
}

/** Fields that only apply to one repair type are nulled out for the other. */
function typeScopedFields(data: {
  type: RepairType;
  departmentId?: number;
  customerName?: string;
  customerPhone?: string;
}) {
  const internal = data.type === RepairType.INTERNAL;
  return {
    departmentId:  internal ? data.departmentId ?? null : null,
    customerName:  internal ? null : data.customerName ?? null,
    customerPhone: internal ? null : data.customerPhone ?? null,
  };
}

function closedAtFor(status: RepairStatus, existing: Date | null): Date | null {
  if (CLOSED_STATUSES.includes(status)) return existing ?? new Date();
  return null;
}

/**
 * `RJ-YYMM-NNN`, sequential within the month of `when`.
 * Runs inside the caller's transaction so the read and the insert cannot interleave.
 */
async function nextJobNumber(tx: Prisma.TransactionClient, when: Date): Promise<string> {
  const yy = String(when.getFullYear()).slice(-2);
  const mm = String(when.getMonth() + 1).padStart(2, "0");
  const prefix = `RJ-${yy}${mm}-`;

  const latest = await tx.repairJob.findFirst({
    where: { jobNumber: { startsWith: prefix } },
    orderBy: { jobNumber: "desc" },
    select: { jobNumber: true },
  });

  const seq = latest ? Number(latest.jobNumber.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq).padStart(3, "0")}`;
}

function readFiles(formData: FormData): File[] {
  return formData
    .getAll("files")
    .filter((f): f is File => f instanceof File && f.size > 0);
}

/**
 * Rejects bad uploads *before* any row is written. Validating inside
 * `saveAttachments` would leave an orphaned job behind whenever a file was
 * rejected, because the job is inserted first.
 */
async function assertAttachmentsValid(files: File[]) {
  const t = await getTranslations("RepairActions");
  for (const file of files) {
    if (!EXT_FOR_MIME[file.type]) throw new AttachmentError(t("fileTypeError"));
    if (file.size > MAX_FILE_SIZE) throw new AttachmentError(t("fileTooLarge"));
  }
}

async function saveAttachments(files: File[], repairJobId: number, userId: string) {
  for (const file of files) {
    const ext = EXT_FOR_MIME[file.type];
    const url = await saveUpload(file, "repairs", ext);
    await prisma.repairAttachment.create({
      data: {
        repairJobId,
        fileUrl:      url,
        fileName:     file.name,
        mimeType:     file.type,
        uploadedById: userId,
      },
    });
  }
}

export async function createRepairAction(
  _prev: RepairActionState,
  formData: FormData
): Promise<RepairActionState> {
  const session = await auth();
  const t = await getTranslations("RepairActions");
  const userId = session?.user?.id;
  if (!userId) return { success: false, message: t("loginRequired") };

  const schema = await buildRepairSchema();
  const parsed = schema.safeParse(readRepairForm(formData));
  if (!parsed.success) {
    return { success: false, message: t("invalidData"), errors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;

  const files = readFiles(formData);

  try {
    await assertAttachmentsValid(files);

    const created = await prisma.$transaction(async (tx) => {
      const jobNumber = await nextJobNumber(tx, d.reportedAt);
      return tx.repairJob.create({
        data: {
          jobNumber,
          type:         d.type,
          ...typeScopedFields(d),
          ownerName:    d.ownerName ?? null,
          ownerTel:     d.ownerTel ?? null,
          deviceTypeId: d.deviceTypeId ?? null,
          deviceName:   d.deviceName,
          deviceModel:  d.deviceModel ?? null,
          serialNo:     d.serialNo ?? null,
          serviceTag:   d.serviceTag ?? null,
          expressNo:    d.expressNo ?? null,
          problem:      d.problem,
          partsUsed:    d.partsUsed ?? null,
          partsCost:    d.partsCost,
          labourCost:   d.labourCost,
          totalCost:    d.partsCost + d.labourCost,
          status:       d.status,
          technicianId: d.technicianId ?? null,
          createdById:  userId,
          reportedAt:   d.reportedAt,
          closedAt:     closedAtFor(d.status, null),
          note:         d.note ?? null,
        },
      });
    });

    await saveAttachments(files, created.id, userId);

    revalidatePath("/repairs");
    revalidatePath("/repairs/overview");
    return { success: true, message: t("createSuccess") };
  } catch (e: any) {
    if (e instanceof AttachmentError) return { success: false, message: e.message };
    if (e.code === "P2002") return { success: false, message: t("jobNumberClash") };
    return { success: false, message: t("genericError") };
  }
}

export async function updateRepairAction(
  _prev: RepairActionState,
  formData: FormData
): Promise<RepairActionState> {
  const session = await auth();
  const t = await getTranslations("RepairActions");
  const userId = session?.user?.id;
  if (!userId) return { success: false, message: t("loginRequired") };

  const id = Number(formData.get("id"));
  if (!id) return { success: false, message: t("notFound") };

  const schema = await buildRepairSchema();
  const parsed = schema.safeParse(readRepairForm(formData));
  if (!parsed.success) {
    return { success: false, message: t("invalidData"), errors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;

  const existing = await prisma.repairJob.findUnique({ where: { id } });
  if (!existing) return { success: false, message: t("notFound") };

  if (existing.status !== d.status && !TRANSITIONS[existing.status].includes(d.status)) {
    return {
      success: false,
      message: t("illegalTransition"),
      errors: { status: [t("illegalTransition")] },
    };
  }

  const files = readFiles(formData);

  try {
    await assertAttachmentsValid(files);

    await prisma.repairJob.update({
      where: { id },
      data: {
        type:         d.type,
        ...typeScopedFields(d),
        ownerName:    d.ownerName ?? null,
        ownerTel:     d.ownerTel ?? null,
        deviceTypeId: d.deviceTypeId ?? null,
        deviceName:   d.deviceName,
        deviceModel:  d.deviceModel ?? null,
        serialNo:     d.serialNo ?? null,
        serviceTag:   d.serviceTag ?? null,
        expressNo:    d.expressNo ?? null,
        problem:      d.problem,
        partsUsed:    d.partsUsed ?? null,
        partsCost:    d.partsCost,
        labourCost:   d.labourCost,
        totalCost:    d.partsCost + d.labourCost,
        status:       d.status,
        technicianId: d.technicianId ?? null,
        reportedAt:   d.reportedAt,
        closedAt:     closedAtFor(d.status, existing.closedAt),
        note:         d.note ?? null,
      },
    });

    await saveAttachments(files, id, userId);

    revalidatePath("/repairs");
    revalidatePath("/repairs/overview");
    return { success: true, message: t("updateSuccess") };
  } catch (e: any) {
    if (e instanceof AttachmentError) return { success: false, message: e.message };
    if (e.code === "P2025") return { success: false, message: t("notFound") };
    return { success: false, message: t("genericError") };
  }
}

export async function updateRepairStatusAction(
  id: number,
  status: RepairStatus
): Promise<RepairActionState> {
  const session = await auth();
  const t = await getTranslations("RepairActions");
  if (!session?.user) return { success: false, message: t("loginRequired") };

  const existing = await prisma.repairJob.findUnique({ where: { id } });
  if (!existing) return { success: false, message: t("notFound") };
  if (existing.status === status) return { success: true, message: t("updateSuccess") };
  if (!TRANSITIONS[existing.status].includes(status)) {
    return { success: false, message: t("illegalTransition") };
  }

  try {
    await prisma.repairJob.update({
      where: { id },
      data: { status, closedAt: closedAtFor(status, existing.closedAt) },
    });
    revalidatePath("/repairs");
    revalidatePath("/repairs/overview");
    return { success: true, message: t("updateSuccess") };
  } catch {
    return { success: false, message: t("genericError") };
  }
}

export async function deleteRepairAction(id: number): Promise<RepairActionState> {
  const session = await auth();
  const t = await getTranslations("RepairActions");
  if (!session?.user) return { success: false, message: t("loginRequired") };

  try {
    await prisma.repairJob.delete({ where: { id } });
    revalidatePath("/repairs");
    revalidatePath("/repairs/overview");
    return { success: true, message: t("deleteSuccess") };
  } catch (e: any) {
    if (e.code === "P2025") return { success: false, message: t("notFound") };
    return { success: false, message: t("genericError") };
  }
}

export async function deleteRepairAttachmentAction(id: number): Promise<RepairActionState> {
  const session = await auth();
  const t = await getTranslations("RepairActions");
  if (!session?.user) return { success: false, message: t("loginRequired") };

  try {
    const row = await prisma.repairAttachment.delete({ where: { id } });
    revalidatePath(`/repairs/${row.repairJobId}/edit`);
    return { success: true, message: t("attachmentDeleted") };
  } catch (e: any) {
    if (e.code === "P2025") return { success: false, message: t("notFound") };
    return { success: false, message: t("genericError") };
  }
}

export interface RepairFilterParams {
  q?: string;
  status?: string;
  type?: string;
  from?: string;
  to?: string;
}

function buildRepairWhere({ q, status, type, from, to }: RepairFilterParams) {
  const where: any = {};

  if (q) {
    where.OR = [
      { jobNumber:    { contains: q } },
      { deviceName:   { contains: q } },
      { deviceModel:  { contains: q } },
      { serialNo:     { contains: q } },
      { serviceTag:   { contains: q } },
      { expressNo:    { contains: q } },
      { problem:      { contains: q } },
      { customerName: { contains: q } },
      { ownerName:    { contains: q } },
    ];
  }
  if (status && status in RepairStatus) where.status = status as RepairStatus;
  if (type && type in RepairType) where.type = type as RepairType;

  if (from || to) {
    where.reportedAt = {};
    if (from) where.reportedAt.gte = new Date(`${from}T00:00:00`);
    if (to) {
      const end = new Date(`${to}T00:00:00`);
      end.setDate(end.getDate() + 1);
      where.reportedAt.lt = end;
    }
  }
  return where;
}

export async function getRepairJobs(filters: RepairFilterParams = {}) {
  const jobs = await prisma.repairJob.findMany({
    where: buildRepairWhere(filters),
    orderBy: { reportedAt: "desc" },
    include: {
      department: { select: { name: true } },
      technician: { select: { name: true } },
      deviceType: { select: { name: true } },
      createdBy:  { select: { name: true, email: true } },
      _count:     { select: { attachments: true } },
    },
  });

  return jobs.map((j) => ({
    ...j,
    partsCost:  Number(j.partsCost),
    labourCost: Number(j.labourCost),
    totalCost:  Number(j.totalCost),
  }));
}

export type RepairListItem = Awaited<ReturnType<typeof getRepairJobs>>[number];

export async function getRepairJobById(id: number) {
  const job = await prisma.repairJob.findUnique({
    where: { id },
    include: {
      attachments: { orderBy: { createdAt: "asc" } },
      department:  { select: { name: true } },
      technician:  { select: { name: true } },
      deviceType:  { select: { name: true } },
    },
  });
  if (!job) return null;
  return {
    ...job,
    partsCost:  Number(job.partsCost),
    labourCost: Number(job.labourCost),
    totalCost:  Number(job.totalCost),
  };
}

export async function getRepairDashboardStats() {
  const overdueBefore = new Date();
  overdueBefore.setDate(overdueBefore.getDate() - OVERDUE_DAYS);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [grouped, overdue, monthAgg] = await Promise.all([
    prisma.repairJob.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.repairJob.count({
      where: { status: { in: OPEN_STATUSES }, reportedAt: { lt: overdueBefore } },
    }),
    prisma.repairJob.aggregate({
      _sum: { totalCost: true },
      where: { reportedAt: { gte: monthStart } },
    }),
  ]);

  const byStatus = Object.fromEntries(
    Object.values(RepairStatus).map((s) => [s, 0])
  ) as Record<RepairStatus, number>;
  for (const row of grouped) byStatus[row.status] = row._count._all;

  const open = OPEN_STATUSES.reduce((sum, s) => sum + byStatus[s], 0);

  return { open, overdue, byStatus, monthCost: Number(monthAgg._sum.totalCost ?? 0) };
}
