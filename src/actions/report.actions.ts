"use server";

import { prisma } from "@/lib/prisma";

const TOP_PRODUCTS_LIMIT = 5;

export interface ChartSeries {
  key:   string;
  label: string;
  data:  number[]; // one value per day of the month, index 0 = day 1
}

export interface MonthChartData {
  month:              string;
  label:              string;
  daysInMonth:        number;
  departmentSeries:   ChartSeries[];
  topProductSeries:   ChartSeries[];
  totalDepartmentTx:  number;
  totalOutQty:        number;
}

export async function getChartData(): Promise<MonthChartData[]> {
  const transactions = await prisma.stockTransaction.findMany({
    select: {
      type:       true,
      quantity:   true,
      createdAt:  true,
      department: { select: { id: true, name: true } },
      product:    { select: { id: true, code: true, name: true } },
    },
  });

  const byMonth = new Map<string, typeof transactions>();
  for (const tx of transactions) {
    const key = `${tx.createdAt.getFullYear()}-${String(tx.createdAt.getMonth() + 1).padStart(2, "0")}`;
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push(tx);
  }

  const result: MonthChartData[] = [];

  for (const [key, txs] of byMonth) {
    const [year, monthNum] = key.split("-").map(Number);
    const daysInMonth = new Date(year, monthNum, 0).getDate();
    const label = new Date(year, monthNum - 1, 1).toLocaleDateString("th-TH", { month: "long", year: "numeric" });

    const deptMap = new Map<number, { name: string; data: number[] }>();
    const productMap = new Map<number, { code: string; name: string; total: number; data: number[] }>();
    let totalDepartmentTx = 0;
    let totalOutQty = 0;

    for (const tx of txs) {
      const day = tx.createdAt.getDate();

      if (tx.department) {
        if (!deptMap.has(tx.department.id)) {
          deptMap.set(tx.department.id, { name: tx.department.name, data: new Array(daysInMonth).fill(0) });
        }
        deptMap.get(tx.department.id)!.data[day - 1] += 1;
        totalDepartmentTx += 1;
      }

      if (tx.type === "OUT") {
        totalOutQty += tx.quantity;
        if (!productMap.has(tx.product.id)) {
          productMap.set(tx.product.id, {
            code: tx.product.code,
            name: tx.product.name,
            total: 0,
            data: new Array(daysInMonth).fill(0),
          });
        }
        const entry = productMap.get(tx.product.id)!;
        entry.total += tx.quantity;
        entry.data[day - 1] += tx.quantity;
      }
    }

    const departmentSeries: ChartSeries[] = Array.from(deptMap.values())
      .map((v) => ({ key: v.name, label: v.name, data: v.data }))
      .sort((a, b) => a.label.localeCompare(b.label));

    const topProductSeries: ChartSeries[] = Array.from(productMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, TOP_PRODUCTS_LIMIT)
      .map((p) => ({ key: p.code, label: p.name, data: p.data }));

    result.push({ month: key, label, daysInMonth, departmentSeries, topProductSeries, totalDepartmentTx, totalOutQty });
  }

  return result.sort((a, b) => b.month.localeCompare(a.month));
}

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
