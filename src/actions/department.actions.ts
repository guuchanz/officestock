"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

async function buildDepartmentSchema() {
  const t = await getTranslations("DepartmentActions");
  return z.object({
    name: z.string().min(1, t("nameRequired")),
  });
}

export type DepartmentActionState = {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
};

export async function getDepartments() {
  return prisma.department.findMany({ orderBy: { name: "asc" } });
}

export async function getDepartmentsWithCount() {
  return prisma.department.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { transactions: true } } },
  });
}

export async function createDepartmentAction(
  _prev: DepartmentActionState,
  formData: FormData
): Promise<DepartmentActionState> {
  const session = await auth();
  const t = await getTranslations("DepartmentActions");
  if (!session?.user) return { success: false, message: t("loginRequired") };

  const departmentSchema = await buildDepartmentSchema();
  const parsed = departmentSchema.safeParse({ name: formData.get("name") as string });
  if (!parsed.success) {
    return { success: false, message: t("invalidData"), errors: parsed.error.flatten().fieldErrors };
  }

  try {
    await prisma.department.create({ data: parsed.data });
    revalidatePath("/departments");
    return { success: true, message: t("createSuccess") };
  } catch (e: any) {
    if (e.code === "P2002") return { success: false, message: t("duplicateName") };
    return { success: false, message: t("genericError") };
  }
}

export async function updateDepartmentAction(
  _prev: DepartmentActionState,
  formData: FormData
): Promise<DepartmentActionState> {
  const session = await auth();
  const t = await getTranslations("DepartmentActions");
  if (!session?.user) return { success: false, message: t("loginRequired") };

  const id = Number(formData.get("id"));
  if (!id) return { success: false, message: t("notFound") };

  const departmentSchema = await buildDepartmentSchema();
  const parsed = departmentSchema.safeParse({ name: formData.get("name") as string });
  if (!parsed.success) {
    return { success: false, message: t("invalidData"), errors: parsed.error.flatten().fieldErrors };
  }

  try {
    await prisma.department.update({ where: { id }, data: parsed.data });
    revalidatePath("/departments");
    return { success: true, message: t("updateSuccess") };
  } catch (e: any) {
    if (e.code === "P2002") return { success: false, message: t("duplicateName") };
    if (e.code === "P2025") return { success: false, message: t("notFound") };
    return { success: false, message: t("genericError") };
  }
}

export async function deleteDepartmentAction(id: number) {
  const session = await auth();
  const t = await getTranslations("DepartmentActions");
  if (!session?.user) return { success: false, message: t("loginRequired") };

  try {
    await prisma.department.delete({ where: { id } });
    revalidatePath("/departments");
    return { success: true, message: t("deleteSuccess") };
  } catch (e: any) {
    if (e.code === "P2025") return { success: false, message: t("notFound") };
    return { success: false, message: t("genericError") };
  }
}
