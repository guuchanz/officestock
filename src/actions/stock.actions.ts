"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

async function buildStockSchema() {
  const t = await getTranslations("StockActions");
  return z
    .object({
      productId:    z.number().int().positive(),
      type:         z.enum(["IN", "OUT"]),
      quantity:     z.number().int().min(1, t("qtyMin")),
      reason:       z.string().min(1, t("reasonRequired")),
      receiver:     z.string().optional(),
      departmentId: z.number().int().positive().optional(),
      note:         z.string().optional(),
    })
    .superRefine((data, ctx) => {
      if (data.type === "OUT" && !data.receiver?.trim()) {
        ctx.addIssue({
          code:    z.ZodIssueCode.custom,
          path:    ["receiver"],
          message: t("receiverRequired"),
        });
      }
    });
}

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
  const t = await getTranslations("StockActions");
  if (!session?.user?.id) {
    return { success: false, message: t("loginRequired") };
  }

  const departmentIdRaw = formData.get("departmentId") as string;

  const raw = {
    productId:    Number(formData.get("productId")),
    type:         formData.get("type") as "IN" | "OUT",
    quantity:     Number(formData.get("quantity")),
    reason:       formData.get("reason") as string,
    receiver:     (formData.get("receiver") as string) || undefined,
    departmentId: departmentIdRaw ? Number(departmentIdRaw) : undefined,
    note:         formData.get("note") as string | undefined,
  };

  const stockSchema = await buildStockSchema();
  const parsed = stockSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      message: t("invalidData"),
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const { productId, type, quantity, reason, receiver, departmentId, note } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: { id: true, totalStock: true },
      });
      if (!product) throw new Error(t("productNotFound"));

      if (type === "OUT" && product.totalStock < quantity) {
        throw new Error(t("insufficientStock", { qty: product.totalStock }));
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
          receiver: type === "OUT" ? receiver!.trim() : null,
          departmentId: departmentId ?? null,
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
        ? t("importSuccess", { qty: quantity })
        : t("withdrawSuccess", { qty: quantity }),
    };
  } catch (err: any) {
    return { success: false, message: err.message ?? t("genericError") };
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
