"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import path from "path";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { saveUpload } from "@/lib/uploads";

async function buildProductSchema() {
  const t = await getTranslations("ProductActions");
  return z.object({
    code:        z.string().min(1, t("codeRequired")),
    lotNo:       z.string().optional(),
    name:        z.string().min(1, t("nameRequired")),
    description: z.string().optional(),
    categoryId:  z.number().int().positive(t("categoryRequired")),
    minStock:    z.number().int().min(0).default(5),
    location:    z.string().optional(),
    unit:        z.string().optional(),
    unitPrice:   z.number().min(0).optional(),
  });
}

const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

class ImageTypeError extends Error {}

async function saveProductImage(file: File): Promise<string | undefined> {
  if (!file || file.size === 0) return undefined;
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    const t = await getTranslations("ProductActions");
    throw new ImageTypeError(t("imageTypeError"));
  }

  const ext = path.extname(file.name) || "";
  return saveUpload(file, "products", ext);
}

export type ProductActionState = {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
};

export async function createProductAction(
  _prev: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const session = await auth();
  const t = await getTranslations("ProductActions");
  if (!session?.user) return { success: false, message: t("loginRequired") };

  const unitPriceRaw = formData.get("unitPrice") as string;

  const raw = {
    code:        formData.get("code") as string,
    lotNo:       (formData.get("lotNo") as string) || undefined,
    name:        formData.get("name") as string,
    description: (formData.get("description") as string) || undefined,
    categoryId:  Number(formData.get("categoryId")),
    minStock:    Number(formData.get("minStock")) || 5,
    location:    formData.get("location") as string | undefined,
    unit:        (formData.get("unit") as string) || undefined,
    unitPrice:   unitPriceRaw ? Number(unitPriceRaw) : undefined,
  };

  const productSchema = await buildProductSchema();
  const parsed = productSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, message: t("invalidData"), errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const imageFile = formData.get("image") as File | null;
    const image = imageFile ? await saveProductImage(imageFile) : undefined;

    await prisma.product.create({ data: { ...parsed.data, image } });
    revalidatePath("/dashboard");
    return { success: true, message: t("createSuccess") };
  } catch (e: any) {
    if (e.code === "P2002") return { success: false, message: t("duplicateCode") };
    if (e instanceof ImageTypeError) return { success: false, message: e.message };
    return { success: false, message: t("genericError") };
  }
}

export async function updateProductAction(
  _prev: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const session = await auth();
  const t = await getTranslations("ProductActions");
  if (!session?.user) return { success: false, message: t("loginRequired") };

  const id = Number(formData.get("id"));
  if (!id) return { success: false, message: t("notFound") };

  const unitPriceRaw = formData.get("unitPrice") as string;

  const raw = {
    code:        formData.get("code") as string,
    lotNo:       (formData.get("lotNo") as string) || undefined,
    name:        formData.get("name") as string,
    description: (formData.get("description") as string) || undefined,
    categoryId:  Number(formData.get("categoryId")),
    minStock:    Number(formData.get("minStock")) || 5,
    location:    formData.get("location") as string | undefined,
    unit:        (formData.get("unit") as string) || undefined,
    unitPrice:   unitPriceRaw ? Number(unitPriceRaw) : undefined,
  };

  const productSchema = await buildProductSchema();
  const parsed = productSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, message: t("invalidData"), errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const imageFile = formData.get("image") as File | null;
    const image = imageFile ? await saveProductImage(imageFile) : undefined;

    await prisma.product.update({
      where: { id },
      data: { ...parsed.data, description: parsed.data.description ?? null, ...(image ? { image } : {}) },
    });
    revalidatePath("/dashboard");
    revalidatePath("/products");
    return { success: true, message: t("updateSuccess") };
  } catch (e: any) {
    if (e.code === "P2002") return { success: false, message: t("duplicateCode") };
    if (e.code === "P2025") return { success: false, message: t("notFound") };
    if (e instanceof ImageTypeError) return { success: false, message: e.message };
    return { success: false, message: t("genericError") };
  }
}

export async function getProductById(id: number) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: { category: { select: { id: true, name: true } } },
  });
  if (!product) return null;

  return { ...product, unitPrice: product.unitPrice ? Number(product.unitPrice) : null };
}

export async function getProducts(search?: string) {
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { code: { contains: search } },
              { lotNo: { contains: search } },
              { category: { name: { contains: search } } },
            ],
          }
        : {}),
    },
    include: { category: { select: { id: true, name: true } } },
    orderBy: { name: "asc" },
  });

  return products.map((p) => ({
    ...p,
    unitPrice: p.unitPrice ? Number(p.unitPrice) : null,
  }));
}

export async function archiveProductAction(id: number): Promise<ProductActionState> {
  const session = await auth();
  const t = await getTranslations("ProductActions");
  if (!session?.user) return { success: false, message: t("loginRequired") };

  try {
    await prisma.product.update({ where: { id }, data: { isActive: false } });
    revalidatePath("/dashboard");
    revalidatePath("/products");
    return { success: true, message: t("archiveSuccess") };
  } catch (e: any) {
    if (e.code === "P2025") return { success: false, message: t("notFound") };
    return { success: false, message: t("genericError") };
  }
}

export async function getCategories() {
  return prisma.category.findMany({ orderBy: { name: "asc" } });
}

export interface TransactionFilters {
  q?:    string;
  from?: string;
  to?:   string;
}

function buildTransactionWhere({ q, from, to }: TransactionFilters) {
  const where: any = {};

  if (q) {
    where.OR = [
      { reason: { contains: q } },
      { receiver: { contains: q } },
      { note: { contains: q } },
      { product: { name: { contains: q } } },
      { product: { code: { contains: q } } },
      { operator: { name: { contains: q } } },
      { operator: { email: { contains: q } } },
    ];
  }

  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(`${from}T00:00:00`);
    if (to) {
      const end = new Date(`${to}T00:00:00`);
      end.setDate(end.getDate() + 1);
      where.createdAt.lt = end;
    }
  }

  return where;
}

export async function getTransactions(page = 1, pageSize = 20, filters: TransactionFilters = {}) {
  const where = buildTransactionWhere(filters);
  const skip = (page - 1) * pageSize;

  const [items, total] = await Promise.all([
    prisma.stockTransaction.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        product:    { select: { id: true, code: true, name: true } },
        operator:   { select: { id: true, name: true, email: true } },
        department: { select: { id: true, name: true } },
      },
    }),
    prisma.stockTransaction.count({ where }),
  ]);
  return { items, total, pages: Math.ceil(total / pageSize) };
}

export async function getAllTransactions(filters: TransactionFilters = {}) {
  const where = buildTransactionWhere(filters);
  return prisma.stockTransaction.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      product:    { select: { code: true, name: true } },
      operator:   { select: { name: true, email: true } },
      department: { select: { name: true } },
    },
  });
}
