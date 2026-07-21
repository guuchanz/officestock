"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

const stockSchema = z.object({
  productId: z.number().int().positive(),
  type:      z.enum(["IN", "OUT"]),
  quantity:  z.number().int().min(1, "จำนวนต้องมากกว่า 0"),
  reason:    z.string().min(1, "กรุณาระบุเหตุผล"),
  note:      z.string().optional(),
});

export type StockActionState = {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
};

export async function stockTransactionAction(
  _prev: StockActionState,
  formData: FormData
): Promise<StockActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "กรุณาเข้าสู่ระบบก่อน" };
  }

  const raw = {
    productId: Number(formData.get("productId")),
    type:      formData.get("type") as "IN" | "OUT",
    quantity:  Number(formData.get("quantity")),
    reason:    formData.get("reason") as string,
    note:      formData.get("note") as string | undefined,
  };

  const parsed = stockSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      message: "ข้อมูลไม่ถูกต้อง",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const { productId, type, quantity, reason, note } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: { id: true, totalStock: true },
      });
      if (!product) throw new Error("ไม่พบสินค้า");

      if (type === "OUT" && product.totalStock < quantity) {
        throw new Error(`สต็อกไม่พอ: มีเพียง ${product.totalStock} ชิ้น`);
      }

      const delta = type === "IN" ? quantity : -quantity;

      await tx.product.update({
        where: { id: productId },
        data:  { totalStock: { increment: delta } },
      });

      await tx.stockTransaction.create({
        data: {
          productId,
          type,
          quantity,
          reason,
          note: note || null,
          operatorId: session.user!.id!,
        },
      });
    });

    revalidatePath("/dashboard");
    revalidatePath("/transactions");

    return {
      success: true,
      message: type === "IN"
        ? `นำเข้าสต็อก ${quantity} ชิ้น สำเร็จ`
        : `เบิกออก ${quantity} ชิ้น สำเร็จ`,
    };
  } catch (err: any) {
    return { success: false, message: err.message ?? "เกิดข้อผิดพลาด" };
  }
}

export async function getDashboardStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [totalProducts, lowStockProducts, todayTx] = await Promise.all([
    prisma.product.count(),
    prisma.product.count({ where: { totalStock: { lte: prisma.product.fields.minStock } } }),
    prisma.stockTransaction.findMany({
      where: { createdAt: { gte: today } },
      select: { type: true, quantity: true },
    }),
  ]);

  // workaround: lte on same field not supported in all Prisma versions
  const lowStock = await prisma.product.count({
    where: { AND: [{ totalStock: { gt: 0 } }, { totalStock: { lte: 5 } }] },
  });
  const zeroStock = await prisma.product.count({ where: { totalStock: 0 } });

  const todayIn  = todayTx.filter(t => t.type === "IN").reduce((s, t) => s + t.quantity, 0);
  const todayOut = todayTx.filter(t => t.type === "OUT").reduce((s, t) => s + t.quantity, 0);

  return { totalProducts, lowStockProducts: lowStock + zeroStock, todayIn, todayOut };
}
