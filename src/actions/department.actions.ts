"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

const departmentSchema = z.object({
  name: z.string().min(1, "กรุณากรอกชื่อแผนก"),
});

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
  if (!session?.user) return { success: false, message: "กรุณาเข้าสู่ระบบก่อน" };

  const parsed = departmentSchema.safeParse({ name: formData.get("name") as string });
  if (!parsed.success) {
    return { success: false, message: "ข้อมูลไม่ถูกต้อง", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    await prisma.department.create({ data: parsed.data });
    revalidatePath("/departments");
    return { success: true, message: "เพิ่มแผนกสำเร็จ" };
  } catch (e: any) {
    if (e.code === "P2002") return { success: false, message: "มีชื่อแผนกนี้อยู่แล้ว" };
    return { success: false, message: "เกิดข้อผิดพลาด" };
  }
}

export async function updateDepartmentAction(
  _prev: DepartmentActionState,
  formData: FormData
): Promise<DepartmentActionState> {
  const session = await auth();
  if (!session?.user) return { success: false, message: "กรุณาเข้าสู่ระบบก่อน" };

  const id = Number(formData.get("id"));
  if (!id) return { success: false, message: "ไม่พบแผนก" };

  const parsed = departmentSchema.safeParse({ name: formData.get("name") as string });
  if (!parsed.success) {
    return { success: false, message: "ข้อมูลไม่ถูกต้อง", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    await prisma.department.update({ where: { id }, data: parsed.data });
    revalidatePath("/departments");
    return { success: true, message: "แก้ไขแผนกสำเร็จ" };
  } catch (e: any) {
    if (e.code === "P2002") return { success: false, message: "มีชื่อแผนกนี้อยู่แล้ว" };
    if (e.code === "P2025") return { success: false, message: "ไม่พบแผนก" };
    return { success: false, message: "เกิดข้อผิดพลาด" };
  }
}

export async function deleteDepartmentAction(id: number) {
  const session = await auth();
  if (!session?.user) return { success: false, message: "กรุณาเข้าสู่ระบบก่อน" };

  try {
    await prisma.department.delete({ where: { id } });
    revalidatePath("/departments");
    return { success: true, message: "ลบแผนกสำเร็จ" };
  } catch (e: any) {
    if (e.code === "P2025") return { success: false, message: "ไม่พบแผนก" };
    return { success: false, message: "เกิดข้อผิดพลาด" };
  }
}
