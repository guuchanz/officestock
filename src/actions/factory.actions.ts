"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export type FactoryActionState = {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
};

async function buildFactorySchema() {
  const t = await getTranslations("FactoryActions");
  return z.object({
    name:     z.string().min(1, t("nameRequired")),
    isActive: z.boolean(),
  });
}

function readFactoryForm(formData: FormData) {
  return {
    name:     ((formData.get("name") as string) ?? "").trim(),
    isActive: formData.get("isActive") !== "false",
  };
}

export async function createFactoryAction(
  _prev: FactoryActionState,
  formData: FormData
): Promise<FactoryActionState> {
  const session = await auth();
  const t = await getTranslations("FactoryActions");
  if (!session?.user) return { success: false, message: t("loginRequired") };

  const schema = await buildFactorySchema();
  const parsed = schema.safeParse(readFactoryForm(formData));
  if (!parsed.success) {
    return { success: false, message: t("invalidData"), errors: parsed.error.flatten().fieldErrors };
  }

  try {
    await prisma.factory.create({
      data: { name: parsed.data.name, isActive: parsed.data.isActive },
    });
    revalidatePath("/maintenance/factories");
    return { success: true, message: t("createSuccess") };
  } catch (e: any) {
    if (e.code === "P2002") return { success: false, message: t("duplicateName") };
    return { success: false, message: t("genericError") };
  }
}

export async function updateFactoryAction(
  _prev: FactoryActionState,
  formData: FormData
): Promise<FactoryActionState> {
  const session = await auth();
  const t = await getTranslations("FactoryActions");
  if (!session?.user) return { success: false, message: t("loginRequired") };

  const id = Number(formData.get("id"));
  if (!id) return { success: false, message: t("notFound") };

  const schema = await buildFactorySchema();
  const parsed = schema.safeParse(readFactoryForm(formData));
  if (!parsed.success) {
    return { success: false, message: t("invalidData"), errors: parsed.error.flatten().fieldErrors };
  }

  try {
    await prisma.factory.update({
      where: { id },
      data: { name: parsed.data.name, isActive: parsed.data.isActive },
    });
    revalidatePath("/maintenance/factories");
    return { success: true, message: t("updateSuccess") };
  } catch (e: any) {
    if (e.code === "P2002") return { success: false, message: t("duplicateName") };
    if (e.code === "P2025") return { success: false, message: t("notFound") };
    return { success: false, message: t("genericError") };
  }
}

export async function deleteFactoryAction(id: number): Promise<FactoryActionState> {
  const session = await auth();
  const t = await getTranslations("FactoryActions");
  if (!session?.user) return { success: false, message: t("loginRequired") };

  const inUse = await prisma.equipment.count({ where: { factoryId: id } });
  if (inUse > 0) return { success: false, message: t("inUse", { count: inUse }) };

  try {
    await prisma.factory.delete({ where: { id } });
    revalidatePath("/maintenance/factories");
    return { success: true, message: t("deleteSuccess") };
  } catch (e: any) {
    if (e.code === "P2025") return { success: false, message: t("notFound") };
    return { success: false, message: t("genericError") };
  }
}

export async function getFactories(includeInactive = true) {
  return prisma.factory.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
}
