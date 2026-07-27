"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export type AreaActionState = {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
};

async function buildAreaSchema() {
  const t = await getTranslations("AreaActions");
  return z.object({
    name:     z.string().min(1, t("nameRequired")),
    isActive: z.boolean(),
  });
}

function readAreaForm(formData: FormData) {
  return {
    name:     ((formData.get("name") as string) ?? "").trim(),
    isActive: formData.get("isActive") !== "false",
  };
}

export async function createAreaAction(
  _prev: AreaActionState,
  formData: FormData
): Promise<AreaActionState> {
  const session = await auth();
  const t = await getTranslations("AreaActions");
  if (!session?.user) return { success: false, message: t("loginRequired") };

  const schema = await buildAreaSchema();
  const parsed = schema.safeParse(readAreaForm(formData));
  if (!parsed.success) {
    return { success: false, message: t("invalidData"), errors: parsed.error.flatten().fieldErrors };
  }

  try {
    await prisma.area.create({
      data: { name: parsed.data.name, isActive: parsed.data.isActive },
    });
    revalidatePath("/maintenance/areas");
    return { success: true, message: t("createSuccess") };
  } catch (e: any) {
    if (e.code === "P2002") return { success: false, message: t("duplicateName") };
    return { success: false, message: t("genericError") };
  }
}

export async function updateAreaAction(
  _prev: AreaActionState,
  formData: FormData
): Promise<AreaActionState> {
  const session = await auth();
  const t = await getTranslations("AreaActions");
  if (!session?.user) return { success: false, message: t("loginRequired") };

  const id = Number(formData.get("id"));
  if (!id) return { success: false, message: t("notFound") };

  const schema = await buildAreaSchema();
  const parsed = schema.safeParse(readAreaForm(formData));
  if (!parsed.success) {
    return { success: false, message: t("invalidData"), errors: parsed.error.flatten().fieldErrors };
  }

  try {
    await prisma.area.update({
      where: { id },
      data: { name: parsed.data.name, isActive: parsed.data.isActive },
    });
    revalidatePath("/maintenance/areas");
    return { success: true, message: t("updateSuccess") };
  } catch (e: any) {
    if (e.code === "P2002") return { success: false, message: t("duplicateName") };
    if (e.code === "P2025") return { success: false, message: t("notFound") };
    return { success: false, message: t("genericError") };
  }
}

export async function deleteAreaAction(id: number): Promise<AreaActionState> {
  const session = await auth();
  const t = await getTranslations("AreaActions");
  if (!session?.user) return { success: false, message: t("loginRequired") };

  const inUse = await prisma.equipment.count({ where: { areaId: id } });
  if (inUse > 0) return { success: false, message: t("inUse", { count: inUse }) };

  try {
    await prisma.area.delete({ where: { id } });
    revalidatePath("/maintenance/areas");
    return { success: true, message: t("deleteSuccess") };
  } catch (e: any) {
    if (e.code === "P2025") return { success: false, message: t("notFound") };
    return { success: false, message: t("genericError") };
  }
}

export async function getAreas(includeInactive = true) {
  return prisma.area.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
}
