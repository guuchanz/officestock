import { TxType, Role } from "@prisma/client";

export type { TxType, Role };

export interface ProductWithCategory {
  id:         number;
  code:       string;
  name:       string;
  totalStock: number;
  minStock:   number;
  location:   string | null;
  unit:       string | null;
  unitPrice:  number | null;
  image:      string | null;
  updatedAt:  Date;
  category:   { id: number; name: string };
}

export interface TransactionWithDetails {
  id:         number;
  type:       TxType;
  quantity:   number;
  reason:     string;
  receiver:   string | null;
  note:       string | null;
  createdAt:  Date;
  product:    { id: number; code: string; name: string };
  operator:   { id: string; name: string | null; email: string };
  department: { id: number; name: string } | null;
}

export interface DashboardStats {
  totalProducts:    number;
  lowStockProducts: number;
  todayIn:          number;
  todayOut:         number;
}

export const REASON_OPTIONS = {
  OUT: ["เบิกใช้งาน", "ของชำรุด", "คืนผู้ผลิต", "ปรับปรุงยอด"],
  IN:  ["ซื้อเติม", "รับคืนจากพนักงาน", "รับบริจาค", "ปรับปรุงยอด"],
} as const;
