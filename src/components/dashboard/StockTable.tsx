"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { clsx } from "clsx";
import { Search, ArrowDownCircle, ArrowUpCircle, Package, Pencil } from "lucide-react";
import type { ProductWithCategory } from "@/types";
import StockModal from "@/components/stock/StockModal";

interface StockTableProps {
  products: ProductWithCategory[];
  search?:  string;
}

export default function StockTable({ products, search }: StockTableProps) {
  const router       = useRouter();
  const pathname     = usePathname();
  const [q, setQ]   = useState(search ?? "");
  const [, startT]  = useTransition();

  const [modal, setModal] = useState<{
    open: boolean;
    type: "IN" | "OUT";
    product: ProductWithCategory | null;
  }>({ open: false, type: "IN", product: null });
  const [modalKey, setModalKey] = useState(0);

  const [preview, setPreview] = useState<{
    src: string;
    alt: string;
    top: number;
    left: number;
  } | null>(null);

  const showPreview = (e: React.MouseEvent<HTMLElement>, src: string, alt: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPreview({ src, alt, top: rect.top, left: rect.right + 10 });
  };

  const handleSearch = (val: string) => {
    setQ(val);
    startT(() => {
      const params = new URLSearchParams();
      if (val) params.set("q", val);
      router.replace(`${pathname}?${params.toString()}`);
    });
  };

  const openModal = (type: "IN" | "OUT", product: ProductWithCategory) => {
    setModalKey((k) => k + 1);
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
                <th className="px-5 py-3 font-medium">รูป</th>
                <th className="px-4 py-3 font-medium">รหัส</th>
                <th className="px-4 py-3 font-medium">ชื่อสินค้า</th>
                <th className="px-4 py-3 font-medium">หมวดหมู่</th>
                <th className="px-4 py-3 font-medium">ที่เก็บ</th>
                <th className="px-4 py-3 font-medium text-right">ราคาต่อหน่วย</th>
                <th className="px-4 py-3 font-medium text-center">จำนวน/หน่วย</th>
                <th className="px-4 py-3 font-medium text-center">สถานะ</th>
                <th className="px-5 py-3 font-medium text-right">การดำเนินการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 text-sm">
                    ไม่พบสินค้า
                  </td>
                </tr>
              )}
              {products.map((p) => {
                const isLow  = p.totalStock > 0 && p.totalStock <= p.minStock;
                const isZero = p.totalStock === 0;
                return (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3.5">
                      {p.image ? (
                        <Image
                          src={p.image}
                          alt={p.name}
                          width={36}
                          height={36}
                          onMouseEnter={(e) => showPreview(e, p.image!, p.name)}
                          onMouseLeave={() => setPreview(null)}
                          className="h-9 w-9 rounded-lg object-cover border border-slate-200 cursor-zoom-in transition-transform hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 border border-slate-200 text-slate-300">
                          <Package size={16} />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-slate-500">{p.code}</td>
                    <td className="px-4 py-3.5 font-medium text-slate-800">{p.name}</td>
                    <td className="px-4 py-3.5 text-slate-500">{p.category.name}</td>
                    <td className="px-4 py-3.5 text-slate-500 text-xs">{p.location ?? "—"}</td>
                    <td className="px-4 py-3.5 text-slate-600 text-xs text-right tabular-nums">
                      {p.unitPrice != null ? `฿${p.unitPrice.toFixed(2)}` : "—"}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span
                        className={clsx(
                          "inline-block text-lg font-bold tabular-nums",
                          isZero ? "text-red-600" : isLow ? "text-amber-600" : "text-slate-800"
                        )}
                      >
                        {p.totalStock}
                      </span>
                      <span className="text-xs text-slate-400 ml-1">{p.unit ?? "ชิ้น"}</span>
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
                        <Link
                          href={`/products/${p.id}/edit`}
                          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-all"
                          title="แก้ไข"
                        >
                          <Pencil size={14} />
                          แก้ไข
                        </Link>
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
          key={modalKey}
          open={modal.open}
          type={modal.type}
          product={modal.product}
          onClose={() => setModal((m) => ({ ...m, open: false }))}
        />
      )}

      {preview && (
        <div
          className="fixed z-50 pointer-events-none rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl animate-in fade-in zoom-in-95 duration-100"
          style={{ top: preview.top, left: preview.left }}
        >
          <Image
            src={preview.src}
            alt={preview.alt}
            width={192}
            height={192}
            className="h-48 w-48 rounded-lg object-cover"
          />
        </div>
      )}
    </>
  );
}
