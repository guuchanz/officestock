"use server";

import { prisma } from "@/lib/prisma";

export interface MonthlyCostSummary {
  month:     string;
  label:     string;
  inQty:     number;
  outQty:    number;
  inCost:    number;
  outCost:   number;
  totalCost: number;
}

export async function getMonthlyCostReport(): Promise<MonthlyCostSummary[]> {
  const transactions = await prisma.stockTransaction.findMany({
    select: {
      type:      true,
      quantity:  true,
      createdAt: true,
      product:   { select: { unitPrice: true } },
    },
  });

  const summaries = new Map<string, MonthlyCostSummary>();

  for (const tx of transactions) {
    const year  = tx.createdAt.getFullYear();
    const month = tx.createdAt.getMonth();
    const key   = `${year}-${String(month + 1).padStart(2, "0")}`;

    if (!summaries.has(key)) {
      summaries.set(key, {
        month:     key,
        label:     new Date(year, month, 1).toLocaleDateString("th-TH", { month: "long", year: "numeric" }),
        inQty:     0,
        outQty:    0,
        inCost:    0,
        outCost:   0,
        totalCost: 0,
      });
    }

    const entry = summaries.get(key)!;
    const unitPrice = tx.product.unitPrice ? Number(tx.product.unitPrice) : 0;
    const cost = unitPrice * tx.quantity;

    if (tx.type === "IN") {
      entry.inQty  += tx.quantity;
      entry.inCost += cost;
    } else {
      entry.outQty  += tx.quantity;
      entry.outCost += cost;
    }
    entry.totalCost = entry.inCost + entry.outCost;
  }

  return Array.from(summaries.values()).sort((a, b) => b.month.localeCompare(a.month));
}

export interface TransactionDetailRow {
  id:          number;
  createdAt:   Date;
  type:        "IN" | "OUT";
  productCode: string;
  productName: string;
  unit:        string | null;
  quantity:    number;
  unitPrice:   number;
  cost:        number;
  reason:      string;
  receiver:    string | null;
  note:        string | null;
  operator:    string;
}

function isValidMonth(month: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
}

export async function getMonthTransactionDetails(month: string): Promise<TransactionDetailRow[]> {
  if (!isValidMonth(month)) return [];

  const [year, monthNum] = month.split("-").map(Number);
  const start = new Date(year, monthNum - 1, 1);
  const end   = new Date(year, monthNum, 1);

  const transactions = await prisma.stockTransaction.findMany({
    where:   { createdAt: { gte: start, lt: end } },
    orderBy: { createdAt: "asc" },
    include: {
      product:  { select: { code: true, name: true, unit: true, unitPrice: true } },
      operator: { select: { name: true, email: true } },
    },
  });

  return transactions.map((tx) => {
    const unitPrice = tx.product.unitPrice ? Number(tx.product.unitPrice) : 0;
    return {
      id:          tx.id,
      createdAt:   tx.createdAt,
      type:        tx.type,
      productCode: tx.product.code,
      productName: tx.product.name,
      unit:        tx.product.unit,
      quantity:    tx.quantity,
      unitPrice,
      cost:        unitPrice * tx.quantity,
      reason:      tx.reason,
      receiver:    tx.receiver,
      note:        tx.note,
      operator:    tx.operator.name ?? tx.operator.email,
    };
  });
}
