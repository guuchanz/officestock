"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export type TechnicianActionState = {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
};

async function buildTechnicianSchema() {
  const t = await getTranslations("TechnicianActions");
  return z.object({
    name:     z.string().min(1, t("nameRequired")),
    phone:    z.string().optional(),
    isActive: z.boolean(),
  });
}

function readTechnicianForm(formData: FormData) {
  return {
    name:     ((formData.get("name") as string) ?? "").trim(),
    phone:    ((formData.get("phone") as string) || "").trim() || undefined,
    isActive: formData.get("isActive") !== "false",
  };
}

export async function createTechnicianAction(
  _prev: TechnicianActionState,
  formData: FormData
): Promise<TechnicianActionState> {
  const session = await auth();
  const t = await getTranslations("TechnicianActions");
  if (!session?.user) return { success: false, message: t("loginRequired") };

  const schema = await buildTechnicianSchema();
  const parsed = schema.safeParse(readTechnicianForm(formData));
  if (!parsed.success) {
    return { success: false, message: t("invalidData"), errors: parsed.error.flatten().fieldErrors };
  }

  try {
    await prisma.technician.create({
      data: {
        name:     parsed.data.name,
        phone:    parsed.data.phone ?? null,
        isActive: parsed.data.isActive,
      },
    });
    revalidatePath("/repairs/technicians");
    return { success: true, message: t("createSuccess") };
  } catch (e: any) {
    if (e.code === "P2002") return { success: false, message: t("duplicateName") };
    return { success: false, message: t("genericError") };
  }
}

export async function updateTechnicianAction(
  _prev: TechnicianActionState,
  formData: FormData
): Promise<TechnicianActionState> {
  const session = await auth();
  const t = await getTranslations("TechnicianActions");
  if (!session?.user) return { success: false, message: t("loginRequired") };

  const id = Number(formData.get("id"));
  if (!id) return { success: false, message: t("notFound") };

  const schema = await buildTechnicianSchema();
  const parsed = schema.safeParse(readTechnicianForm(formData));
  if (!parsed.success) {
    return { success: false, message: t("invalidData"), errors: parsed.error.flatten().fieldErrors };
  }

  try {
    await prisma.technician.update({
      where: { id },
      data: {
        name:     parsed.data.name,
        phone:    parsed.data.phone ?? null,
        isActive: parsed.data.isActive,
      },
    });
    revalidatePath("/repairs/technicians");
    return { success: true, message: t("updateSuccess") };
  } catch (e: any) {
    if (e.code === "P2002") return { success: false, message: t("duplicateName") };
    if (e.code === "P2025") return { success: false, message: t("notFound") };
    return { success: false, message: t("genericError") };
  }
}

export async function deleteTechnicianAction(id: number): Promise<TechnicianActionState> {
  const session = await auth();
  const t = await getTranslations("TechnicianActions");
  if (!session?.user) return { success: false, message: t("loginRequired") };

  const assigned = await prisma.repairJob.count({ where: { technicianId: id } });
  if (assigned > 0) {
    return { success: false, message: t("inUse", { count: assigned }) };
  }

  try {
    await prisma.technician.delete({ where: { id } });
    revalidatePath("/repairs/technicians");
    return { success: true, message: t("deleteSuccess") };
  } catch (e: any) {
    if (e.code === "P2025") return { success: false, message: t("notFound") };
    return { success: false, message: t("genericError") };
  }
}

export async function getTechnicians(includeInactive = true) {
  return prisma.technician.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
}
