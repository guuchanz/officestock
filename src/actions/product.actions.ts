"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

const productSchema = z.object({
  code:       z.string().min(1, "รหัสสินค้าจำเป็น"),
  name:       z.string().min(1, "ชื่อสินค้าจำเป็น"),
  categoryId: z.number().int().positive("กรุณาเลือกหมวดหมู่"),
  minStock:   z.number().int().min(0).default(5),
  location:   z.string().optional(),
});

export async function createProductAction(_prev: any, formData: FormData) {
  const session = await auth();
  if (!session?.user) return { success: false, message: "Unauthorized" };

  const raw = {
    code:       formData.get("code") as string,
    name:       formData.get("name") as string,
    categoryId: Number(formData.get("categoryId")),
    minStock:   Number(formData.get("minStock")) || 5,
    location:   formData.get("location") as string | undefined,
  };

  const parsed = productSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, message: "ข้อมูลไม่ถูกต้อง", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    await prisma.product.create({ data: parsed.data });
    revalidatePath("/dashboard");
    return { success: true, message: "เพิ่มสินค้าสำเร็จ" };
  } catch (e: any) {
    if (e.code === "P2002") return { success: false, message: "รหัสสินค้านี้มีอยู่แล้ว" };
    return { success: false, message: "เกิดข้อผิดพลาด" };
  }
}

export async function getProducts(search?: string) {
  return prisma.product.findMany({
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
}

export async function getCategories() {
  return prisma.category.findMany({ orderBy: { name: "asc" } });
}

export async function getTransactions(page = 1, pageSize = 20) {
  const skip = (page - 1) * pageSize;
  const [items, total] = await Promise.all([
    prisma.stockTransaction.findMany({
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        product:  { select: { id: true, code: true, name: true } },
        operator: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.stockTransaction.count(),
  ]);
  return { items, total, pages: Math.ceil(total / pageSize) };
}
