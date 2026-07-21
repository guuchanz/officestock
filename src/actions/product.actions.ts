"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

const productSchema = z.object({
  code:        z.string().min(1, "รหัสสินค้าจำเป็น"),
  name:        z.string().min(1, "ชื่อสินค้าจำเป็น"),
  description: z.string().optional(),
  categoryId:  z.number().int().positive("กรุณาเลือกหมวดหมู่"),
  minStock:    z.number().int().min(0).default(5),
  location:    z.string().optional(),
  unit:        z.string().optional(),
  unitPrice:   z.number().min(0).optional(),
});

const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

async function saveProductImage(file: File): Promise<string | undefined> {
  if (!file || file.size === 0) return undefined;
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error("รองรับเฉพาะไฟล์รูปภาพ (png, jpg, webp, gif)");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = path.extname(file.name) || "";
  const filename = `${randomUUID()}${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads", "products");
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, filename), buffer);
  return `/uploads/products/${filename}`;
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
  if (!session?.user) return { success: false, message: "กรุณาเข้าสู่ระบบก่อน" };

  const unitPriceRaw = formData.get("unitPrice") as string;

  const raw = {
    code:        formData.get("code") as string,
    name:        formData.get("name") as string,
    description: (formData.get("description") as string) || undefined,
    categoryId:  Number(formData.get("categoryId")),
    minStock:    Number(formData.get("minStock")) || 5,
    location:    formData.get("location") as string | undefined,
    unit:        (formData.get("unit") as string) || undefined,
    unitPrice:   unitPriceRaw ? Number(unitPriceRaw) : undefined,
  };

  const parsed = productSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, message: "ข้อมูลไม่ถูกต้อง", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const imageFile = formData.get("image") as File | null;
    const image = imageFile ? await saveProductImage(imageFile) : undefined;

    await prisma.product.create({ data: { ...parsed.data, image } });
    revalidatePath("/dashboard");
    return { success: true, message: "เพิ่มสินค้าสำเร็จ" };
  } catch (e: any) {
    if (e.code === "P2002") return { success: false, message: "รหัสสินค้านี้มีอยู่แล้ว" };
    if (e instanceof Error && e.message.includes("รูปภาพ")) return { success: false, message: e.message };
    return { success: false, message: "เกิดข้อผิดพลาด" };
  }
}

export async function updateProductAction(
  _prev: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const session = await auth();
  if (!session?.user) return { success: false, message: "กรุณาเข้าสู่ระบบก่อน" };

  const id = Number(formData.get("id"));
  if (!id) return { success: false, message: "ไม่พบสินค้า" };

  const unitPriceRaw = formData.get("unitPrice") as string;

  const raw = {
    code:        formData.get("code") as string,
    name:        formData.get("name") as string,
    description: (formData.get("description") as string) || undefined,
    categoryId:  Number(formData.get("categoryId")),
    minStock:    Number(formData.get("minStock")) || 5,
    location:    formData.get("location") as string | undefined,
    unit:        (formData.get("unit") as string) || undefined,
    unitPrice:   unitPriceRaw ? Number(unitPriceRaw) : undefined,
  };

  const parsed = productSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, message: "ข้อมูลไม่ถูกต้อง", errors: parsed.error.flatten().fieldErrors };
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
    return { success: true, message: "แก้ไขสินค้าสำเร็จ" };
  } catch (e: any) {
    if (e.code === "P2002") return { success: false, message: "รหัสสินค้านี้มีอยู่แล้ว" };
    if (e.code === "P2025") return { success: false, message: "ไม่พบสินค้า" };
    if (e instanceof Error && e.message.includes("รูปภาพ")) return { success: false, message: e.message };
    return { success: false, message: "เกิดข้อผิดพลาด" };
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
    where: search
      ? {
          OR: [
            { name: { contains: search } },
            { code: { contains: search } },
            { category: { name: { contains: search } } },
          ],
        }
      : undefined,
    include: { category: { select: { id: true, name: true } } },
    orderBy: { name: "asc" },
  });

  return products.map((p) => ({
    ...p,
    unitPrice: p.unitPrice ? Number(p.unitPrice) : null,
  }));
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
