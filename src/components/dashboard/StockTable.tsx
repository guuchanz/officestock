"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { clsx } from "clsx";
import { Search, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import type { ProductWithCategory } from "@/types";
import StockModal from "@/components/stock/StockModal";

interface StockTableProps {
  products: ProductWithCategory[];
  search?:  string;
}

export default function StockTable({ products, search }: StockTableProps) {
  const router       = useRouter();
  const [q, setQ]   = useState(search ?? "");
  const [, startT]  = useTransition();

  const [modal, setModal] = useState<{
    open: boolean;
    type: "IN" | "OUT";
    product: ProductWithCategory | null;
  }>({ open: false, type: "IN", product: null });

  const handleSearch = (val: string) => {
    setQ(val);
    startT(() => {
      const params = new URLSearchParams();
      if (val) params.set("q", val);
      router.replace(`/dashboard?${params.toString()}`);
    });
  };

  const openModal = (type: "IN" | "OUT", product: ProductWithCategory) => {
    setModal({ open: true, type, product });
  };

  return (
    <>
      <div className="card overflow-hidden">
        {/* Table Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">รายการสินค้าคงคลัง</h2>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="ค้นหาชื่อ, รหัส, หมวดหมู่..."
              className="input pl-9 w-64 text-xs"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wide">
                <th className="px-5 py-3 font-medium">รหัส</th>
                <th className="px-4 py-3 font-medium">ชื่อสินค้า</th>
                <th className="px-4 py-3 font-medium">หมวดหมู่</th>
                <th className="px-4 py-3 font-medium">ที่เก็บ</th>
                <th className="px-4 py-3 font-medium text-center">จำนวนคงเหลือ</th>
                <th className="px-4 py-3 font-medium text-center">สถานะ</th>
                <th className="px-5 py-3 font-medium text-right">การดำเนินการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 text-sm">
                    ไม่พบสินค้า
                  </td>
                </tr>
              )}
              {products.map((p) => {
                const isLow  = p.totalStock > 0 && p.totalStock <= p.minStock;
                const isZero = p.totalStock === 0;
                return (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-500">{p.code}</td>
                    <td className="px-4 py-3.5 font-medium text-slate-800">{p.name}</td>
                    <td className="px-4 py-3.5 text-slate-500">{p.category.name}</td>
                    <td className="px-4 py-3.5 text-slate-500 text-xs">{p.location ?? "—"}</td>
                    <td className="px-4 py-3.5 text-center">
                      <span
                        className={clsx(
                          "inline-block text-lg font-bold tabular-nums",
                          isZero ? "text-red-600" : isLow ? "text-amber-600" : "text-slate-800"
                        )}
                      >
                        {p.totalStock}
                      </span>
                      <span className="text-xs text-slate-400 ml-1">ชิ้น</span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span
                        className={clsx(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                          isZero ? "badge-low" : isLow ? "badge-warn" : "badge-ok"
                        )}
                      >
                        {isZero ? "หมด" : isLow ? "ใกล้หมด" : "ปกติ"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openModal("OUT", p)}
                          disabled={isZero}
                          className={clsx(
                            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                            isZero
                              ? "text-slate-300 cursor-not-allowed"
                              : "text-red-600 hover:bg-red-50 hover:text-red-700"
                          )}
                          title="เบิกออก"
                        >
                          <ArrowUpCircle size={14} />
                          เบิก
                        </button>
                        <button
                          onClick={() => openModal("IN", p)}
                          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-green-600 hover:bg-green-50 hover:text-green-700 transition-all"
                          title="นำเข้า"
                        >
                          <ArrowDownCircle size={14} />
                          นำเข้า
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400">
          แสดง {products.length} รายการ
        </div>
      </div>

      {modal.product && (
        <StockModal
          open={modal.open}
          type={modal.type}
          product={modal.product}
          onClose={() => setModal((m) => ({ ...m, open: false }))}
        />
      )}
    </>
  );
}
