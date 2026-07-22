"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

async function buildCategorySchema() {
  const t = await getTranslations("CategoryActions");
  return z.object({
    name: z.string().min(1, t("nameRequired")),
  });
}

export type CategoryActionState = {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
};

export async function getCategoriesWithCount() {
  return prisma.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  });
}

export async function createCategoryAction(
  _prev: CategoryActionState,
  formData: FormData
): Promise<CategoryActionState> {
  const session = await auth();
  const t = await getTranslations("CategoryActions");
  if (!session?.user) return { success: false, message: t("loginRequired") };

  const categorySchema = await buildCategorySchema();
  const parsed = categorySchema.safeParse({ name: formData.get("name") as string });
  if (!parsed.success) {
    return { success: false, message: t("invalidData"), errors: parsed.error.flatten().fieldErrors };
  }

  try {
    await prisma.category.create({ data: parsed.data });
    revalidatePath("/categories");
    return { success: true, message: t("createSuccess") };
  } catch (e: any) {
    if (e.code === "P2002") return { success: false, message: t("duplicateName") };
    return { success: false, message: t("genericError") };
  }
}

export async function updateCategoryAction(
  _prev: CategoryActionState,
  formData: FormData
): Promise<CategoryActionState> {
  const session = await auth();
  const t = await getTranslations("CategoryActions");
  if (!session?.user) return { success: false, message: t("loginRequired") };

  const id = Number(formData.get("id"));
  if (!id) return { success: false, message: t("notFound") };

  const categorySchema = await buildCategorySchema();
  const parsed = categorySchema.safeParse({ name: formData.get("name") as string });
  if (!parsed.success) {
    return { success: false, message: t("invalidData"), errors: parsed.error.flatten().fieldErrors };
  }

  try {
    await prisma.category.update({ where: { id }, data: parsed.data });
    revalidatePath("/categories");
    revalidatePath("/products");
    return { success: true, message: t("updateSuccess") };
  } catch (e: any) {
    if (e.code === "P2002") return { success: false, message: t("duplicateName") };
    if (e.code === "P2025") return { success: false, message: t("notFound") };
    return { success: false, message: t("genericError") };
  }
}

export async function deleteCategoryAction(id: number) {
  const session = await auth();
  const t = await getTranslations("CategoryActions");
  if (!session?.user) return { success: false, message: t("loginRequired") };

  try {
    await prisma.category.delete({ where: { id } });
    revalidatePath("/categories");
    return { success: true, message: t("deleteSuccess") };
  } catch (e: any) {
    if (e.code === "P2025") return { success: false, message: t("notFound") };
    if (e.code === "P2003") return { success: false, message: t("hasProducts") };
    return { success: false, message: t("genericError") };
  }
}
