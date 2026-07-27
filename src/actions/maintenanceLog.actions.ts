"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { MaintResult, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { computeNextDue } from "@/lib/maintenance-constants";
import { pairParts, totalCost, type PendingPart } from "@/lib/parts";

export type MaintenanceLogActionState = {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
};

async function buildLogSchema() {
  const t = await getTranslations("MaintenanceLogActions");

  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  return z.object({
    equipmentId:  z.number().int().positive(),
    performedAt:  z
      .date({ invalid_type_error: t("dateRequired") })
      // A service that has not happened yet must not push the next due date out.
      .max(endOfToday, t("dateFuture")),
    technicianId: z.number().int().positive().optional(),
    result:       z.nativeEnum(MaintResult),
    labourCost:   z.number({ invalid_type_error: t("costInvalid") }).min(0, t("costInvalid")),
    note:         z.string().optional(),
  });
}

const str = (fd: FormData, key: string) => {
  const v = ((fd.get(key) as string) ?? "").trim();
  return v === "" ? undefined : v;
};

/**
 * Rebuilds `lastDoneAt` / `nextDueAt` from the asset's actual log history.
 *
 * Always runs inside the caller's transaction: if the log write committed and
 * this did not, the asset's schedule would silently disagree with its own
 * history — exactly the failure this module exists to prevent.
 */
async function recomputeSchedule(tx: Prisma.TransactionClient, equipmentId: number) {
  const equipment = await tx.equipment.findUnique({
    where: { id: equipmentId },
    select: { baselineAt: true, intervalMonths: true },
  });
  if (!equipment) return;

  const newest = await tx.maintenanceLog.findFirst({
    where: { equipmentId },
    orderBy: { performedAt: "desc" },
    select: { performedAt: true },
  });

  const lastDoneAt = newest?.performedAt ?? null;
  await tx.equipment.update({
    where: { id: equipmentId },
    data: {
      lastDoneAt,
      nextDueAt: computeNextDue(equipment.baselineAt, lastDoneAt, equipment.intervalMonths),
    },
  });
}

function revalidateFor(equipmentId: number) {
  revalidatePath(`/maintenance/${equipmentId}`);
  revalidatePath("/maintenance");
  revalidatePath("/maintenance/overview");
  revalidatePath("/dashboard");
}

export async function createMaintenanceLogAction(
  _prev: MaintenanceLogActionState,
  formData: FormData
): Promise<MaintenanceLogActionState> {
  const session = await auth();
  const t = await getTranslations("MaintenanceLogActions");
  if (!session?.user?.id) return { success: false, message: t("loginRequired") };

  const performed = str(formData, "performedAt");
  const technician = str(formData, "technicianId");
  const labourRaw = str(formData, "labourCost");

  // One `partCosts` input is rendered per part row, in the same order as
  // `partNames`, so the two arrays line up by index.
  const parts: PendingPart[] = pairParts(
    formData.getAll("partNames"),
    formData.getAll("partCosts")
  );

  const schema = await buildLogSchema();
  const parsed = schema.safeParse({
    equipmentId:  Number(formData.get("equipmentId")),
    performedAt:  performed ? new Date(performed) : new Date(NaN),
    technicianId: technician ? Number(technician) : undefined,
    result:       (formData.get("result") as string) || MaintResult.OK,
    labourCost:   labourRaw ? Number(labourRaw) : 0,
    note:         str(formData, "note"),
  });
  if (!parsed.success) {
    return { success: false, message: t("invalidData"), errors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.maintenanceLog.create({
        data: {
          equipmentId:  d.equipmentId,
          performedAt:  d.performedAt,
          technicianId: d.technicianId,
          result:       d.result,
          labourCost:   new Prisma.Decimal(d.labourCost),
          // Derived server-side; a client-supplied total would be trusting the
          // browser with the number the reports add up.
          cost:         new Prisma.Decimal(totalCost(d.labourCost, parts)),
          note:         d.note,
          createdById:  session.user!.id!,
          parts: parts.length
            ? { create: parts.map((p) => ({ name: p.name, cost: new Prisma.Decimal(p.cost) })) }
            : undefined,
        },
      });
      await recomputeSchedule(tx, d.equipmentId);
    });

    revalidateFor(d.equipmentId);
    return { success: true, message: t("createSuccess") };
  } catch (e: any) {
    if (e.code === "P2003") return { success: false, message: t("badReference") };
    return { success: false, message: t("genericError") };
  }
}

export async function deleteMaintenanceLogAction(
  id: number
): Promise<MaintenanceLogActionState> {
  const session = await auth();
  const t = await getTranslations("MaintenanceLogActions");
  if (!session?.user) return { success: false, message: t("loginRequired") };

  try {
    const equipmentId = await prisma.$transaction(async (tx) => {
      const row = await tx.maintenanceLog.delete({ where: { id } });
      await recomputeSchedule(tx, row.equipmentId);
      return row.equipmentId;
    });

    revalidateFor(equipmentId);
    return { success: true, message: t("deleteSuccess") };
  } catch (e: any) {
    if (e.code === "P2025") return { success: false, message: t("notFound") };
    return { success: false, message: t("genericError") };
  }
}
