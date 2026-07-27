"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  computeNextDue, remainingDays, bucketFor, startOfDay,
  DUE_SOON_DAYS, MIN_INTERVAL_MONTHS, MAX_INTERVAL_MONTHS,
  type DueBucket,
} from "@/lib/maintenance-constants";

export type EquipmentActionState = {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
};

async function buildEquipmentSchema() {
  const t = await getTranslations("EquipmentActions");

  // A form submitted at 23:00 local time must not be rejected for a baseline
  // of "today", so the future check allows one day of slack.
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  return z.object({
    assetNo:        z.string().min(1, t("assetNoRequired")).max(191),
    name:           z.string().min(1, t("nameRequired")).max(191),
    model:          z.string().max(191).optional(),
    serialNo:       z.string().max(191).optional(),
    detail:         z.string().optional(),
    factoryId:      z.number().int().positive().optional(),
    areaId:         z.number().int().positive().optional(),
    technicianId:   z.number().int().positive().optional(),
    intervalMonths: z
      .number({ invalid_type_error: t("intervalInvalid") })
      .int(t("intervalInvalid"))
      .min(MIN_INTERVAL_MONTHS, t("intervalInvalid"))
      .max(MAX_INTERVAL_MONTHS, t("intervalInvalid")),
    baselineAt:     z
      .date({ invalid_type_error: t("baselineRequired") })
      .max(tomorrow, t("baselineFuture")),
    isActive:       z.boolean(),
    note:           z.string().optional(),
  });
}

const str = (fd: FormData, key: string) => {
  const v = ((fd.get(key) as string) ?? "").trim();
  return v === "" ? undefined : v;
};
const num = (fd: FormData, key: string) => {
  const v = str(fd, key);
  return v === undefined ? undefined : Number(v);
};

function readEquipmentForm(formData: FormData) {
  const baseline = str(formData, "baselineAt");
  return {
    assetNo:        str(formData, "assetNo") ?? "",
    name:           str(formData, "name") ?? "",
    model:          str(formData, "model"),
    serialNo:       str(formData, "serialNo"),
    detail:         str(formData, "detail"),
    factoryId:      num(formData, "factoryId"),
    areaId:         num(formData, "areaId"),
    technicianId:   num(formData, "technicianId"),
    intervalMonths: num(formData, "intervalMonths") ?? NaN,
    baselineAt:     baseline ? new Date(baseline) : new Date(NaN),
    isActive:       formData.get("isActive") !== "false",
    note:           str(formData, "note"),
  };
}

function revalidateEquipment(id?: number) {
  revalidatePath("/maintenance");
  revalidatePath("/maintenance/overview");
  revalidatePath("/dashboard");
  if (id) revalidatePath(`/maintenance/${id}`);
}

export async function createEquipmentAction(
  _prev: EquipmentActionState,
  formData: FormData
): Promise<EquipmentActionState> {
  const session = await auth();
  const t = await getTranslations("EquipmentActions");
  if (!session?.user?.id) return { success: false, message: t("loginRequired") };

  const schema = await buildEquipmentSchema();
  const parsed = schema.safeParse(readEquipmentForm(formData));
  if (!parsed.success) {
    return { success: false, message: t("invalidData"), errors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;

  try {
    await prisma.equipment.create({
      data: {
        assetNo:        d.assetNo,
        name:           d.name,
        model:          d.model,
        serialNo:       d.serialNo,
        detail:         d.detail,
        factoryId:      d.factoryId,
        areaId:         d.areaId,
        technicianId:   d.technicianId,
        intervalMonths: d.intervalMonths,
        baselineAt:     d.baselineAt,
        lastDoneAt:     null,
        nextDueAt:      computeNextDue(d.baselineAt, null, d.intervalMonths),
        isActive:       d.isActive,
        note:           d.note,
        createdById:    session.user.id,
      },
    });
    revalidateEquipment();
    return { success: true, message: t("createSuccess") };
  } catch (e: any) {
    if (e.code === "P2002") return { success: false, message: t("duplicateAssetNo") };
    if (e.code === "P2003") return { success: false, message: t("badReference") };
    return { success: false, message: t("genericError") };
  }
}

export async function updateEquipmentAction(
  _prev: EquipmentActionState,
  formData: FormData
): Promise<EquipmentActionState> {
  const session = await auth();
  const t = await getTranslations("EquipmentActions");
  if (!session?.user?.id) return { success: false, message: t("loginRequired") };

  const id = Number(formData.get("id"));
  if (!id) return { success: false, message: t("notFound") };

  const schema = await buildEquipmentSchema();
  const parsed = schema.safeParse(readEquipmentForm(formData));
  if (!parsed.success) {
    return { success: false, message: t("invalidData"), errors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;

  const existing = await prisma.equipment.findUnique({
    where: { id },
    select: { lastDoneAt: true },
  });
  if (!existing) return { success: false, message: t("notFound") };

  try {
    await prisma.equipment.update({
      where: { id },
      data: {
        assetNo:        d.assetNo,
        name:           d.name,
        model:          d.model ?? null,
        serialNo:       d.serialNo ?? null,
        detail:         d.detail ?? null,
        factoryId:      d.factoryId ?? null,
        areaId:         d.areaId ?? null,
        technicianId:   d.technicianId ?? null,
        intervalMonths: d.intervalMonths,
        baselineAt:     d.baselineAt,
        // Interval or baseline may have changed, so the schedule is rebuilt
        // from whichever service history the asset already has.
        nextDueAt:      computeNextDue(d.baselineAt, existing.lastDoneAt, d.intervalMonths),
        isActive:       d.isActive,
        note:           d.note ?? null,
      },
    });
    revalidateEquipment(id);
    return { success: true, message: t("updateSuccess") };
  } catch (e: any) {
    if (e.code === "P2002") return { success: false, message: t("duplicateAssetNo") };
    if (e.code === "P2003") return { success: false, message: t("badReference") };
    if (e.code === "P2025") return { success: false, message: t("notFound") };
    return { success: false, message: t("genericError") };
  }
}

export async function deleteEquipmentAction(id: number): Promise<EquipmentActionState> {
  const session = await auth();
  const t = await getTranslations("EquipmentActions");
  if (!session?.user) return { success: false, message: t("loginRequired") };

  try {
    // Service history cascades with the asset — see the note in the design doc.
    await prisma.equipment.delete({ where: { id } });
    revalidateEquipment();
    return { success: true, message: t("deleteSuccess") };
  } catch (e: any) {
    if (e.code === "P2025") return { success: false, message: t("notFound") };
    return { success: false, message: t("genericError") };
  }
}

export interface EquipmentFilterParams {
  q?: string;
  bucket?: string;
  factoryId?: string;
  areaId?: string;
}

function buildEquipmentWhere({ q, bucket, factoryId, areaId }: EquipmentFilterParams) {
  const where: Prisma.EquipmentWhereInput = {};

  if (q) {
    where.OR = [
      { assetNo:  { contains: q } },
      { name:     { contains: q } },
      { model:    { contains: q } },
      { serialNo: { contains: q } },
    ];
  }
  if (factoryId) where.factoryId = Number(factoryId);
  if (areaId) where.areaId = Number(areaId);

  // Bucket boundaries are expressed as nextDueAt ranges so MySQL can use the
  // nextDueAt index instead of us filtering in JS after loading every row.
  const today = startOfDay(new Date());
  const soonEdge = new Date(today);
  soonEdge.setDate(soonEdge.getDate() + DUE_SOON_DAYS + 1);

  if (bucket === "OVERDUE") {
    where.isActive = true;
    where.nextDueAt = { lt: today };
  } else if (bucket === "DUE_SOON") {
    where.isActive = true;
    where.nextDueAt = { gte: today, lt: soonEdge };
  } else if (bucket === "SCHEDULED") {
    where.isActive = true;
    where.nextDueAt = { gte: soonEdge };
  } else if (bucket === "INACTIVE") {
    where.isActive = false;
  }

  return where;
}

const listInclude = {
  factory:    { select: { name: true } },
  area:       { select: { name: true } },
  technician: { select: { name: true } },
  _count:     { select: { logs: true } },
} satisfies Prisma.EquipmentInclude;

export type EquipmentListItem = Prisma.EquipmentGetPayload<{ include: typeof listInclude }> & {
  remaining: number;
  bucket: DueBucket;
};

export async function getEquipmentList(
  filters: EquipmentFilterParams = {}
): Promise<EquipmentListItem[]> {
  const rows = await prisma.equipment.findMany({
    where: buildEquipmentWhere(filters),
    include: listInclude,
    orderBy: { nextDueAt: "asc" },
  });

  const now = new Date();
  return rows.map((r) => ({
    ...r,
    remaining: remainingDays(r.nextDueAt, now),
    bucket:    bucketFor(r.nextDueAt, r.isActive, now),
  }));
}

export async function getEquipmentById(id: number) {
  const row = await prisma.equipment.findUnique({
    where: { id },
    include: {
      factory:    { select: { id: true, name: true } },
      area:       { select: { id: true, name: true } },
      technician: { select: { id: true, name: true } },
      logs: {
        orderBy: { performedAt: "desc" },
        include: {
          technician: { select: { name: true } },
          parts: { orderBy: { id: "asc" } },
        },
      },
      documents: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!row) return null;

  const now = new Date();
  return {
    ...row,
    remaining: remainingDays(row.nextDueAt, now),
    bucket:    bucketFor(row.nextDueAt, row.isActive, now),
    logs: row.logs.map((l) => ({
      ...l,
      cost:       Number(l.cost),
      labourCost: Number(l.labourCost),
      parts:      l.parts.map((p) => ({ ...p, cost: Number(p.cost) })),
    })),
  };
}

export async function getMaintenanceDashboardStats() {
  const today = startOfDay(new Date());
  const soonEdge = new Date(today);
  soonEdge.setDate(soonEdge.getDate() + DUE_SOON_DAYS + 1);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [total, overdue, dueSoon, inactive, doneThisMonth, monthCost] = await Promise.all([
    prisma.equipment.count({ where: { isActive: true } }),
    prisma.equipment.count({ where: { isActive: true, nextDueAt: { lt: today } } }),
    prisma.equipment.count({
      where: { isActive: true, nextDueAt: { gte: today, lt: soonEdge } },
    }),
    prisma.equipment.count({ where: { isActive: false } }),
    prisma.maintenanceLog.count({ where: { performedAt: { gte: monthStart } } }),
    prisma.maintenanceLog.aggregate({
      _sum: { cost: true },
      where: { performedAt: { gte: monthStart } },
    }),
  ]);

  return {
    total,
    overdue,
    dueSoon,
    inactive,
    scheduled: total - overdue - dueSoon,
    doneThisMonth,
    monthCost: Number(monthCost._sum.cost ?? 0),
  };
}
