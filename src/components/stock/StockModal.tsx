"use client";

import { useEffect, useActionState, useRef } from "react";
import { X, Minus, Plus } from "lucide-react";
import { clsx } from "clsx";
import { stockTransactionAction, type StockActionState } from "@/actions/stock.actions";
import { REASON_OPTIONS, type ProductWithCategory } from "@/types";

interface StockModalProps {
  open:        boolean;
  type:        "IN" | "OUT";
  product:     ProductWithCategory;
  departments: { id: number; name: string }[];
  onClose:     () => void;
}

const initState: StockActionState = { success: false, message: "" };

export default function StockModal({ open, type, product, departments, onClose }: StockModalProps) {
  const [state, formAction, pending] = useActionState(stockTransactionAction, initState);
  const qtyRef  = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Close on success
  useEffect(() => {
    if (state.success) {
      const t = setTimeout(() => {
        onClose();
        formRef.current?.reset();
      }, 1200);
      return () => clearTimeout(t);
    }
  }, [state.success, onClose]);

  // Reset on open
  useEffect(() => {
    if (open) formRef.current?.reset();
  }, [open]);

  const adjustQty = (delta: number) => {
    if (!qtyRef.current) return;
    const cur = parseInt(qtyRef.current.value) || 1;
    const next = Math.max(1, cur + delta);
    qtyRef.current.value = String(next);
  };

  if (!open) return null;

  const isIn = type === "IN";
  const accentClass = isIn ? "text-green-600" : "text-red-600";
  const badgeClass  = isIn
    ? "bg-green-100 text-green-700"
    : "bg-red-100 text-red-700";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative card w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={clsx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold", badgeClass)}>
                {isIn ? "▼ นำเข้าสต็อก" : "▲ เบิกออก"}
              </span>
            </div>
            <h2 className="font-semibold text-slate-800 text-sm">{product.name}</h2>
            <p className="text-xs text-slate-400 font-mono">{product.code}</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg">
            <X size={16} />
          </button>
        </div>

        {/* Current Stock Info */}
        <div className="mx-5 mt-4 rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 flex items-center justify-between">
          <span className="text-xs text-slate-500">สต็อกปัจจุบัน</span>
          <span className={clsx("text-2xl font-bold", accentClass)}>
            {product.totalStock} <span className="text-sm font-normal text-slate-400">ชิ้น</span>
          </span>
        </div>

        {/* Form */}
        <form ref={formRef} action={formAction} className="p-5 space-y-4">
          <input type="hidden" name="productId" value={product.id} />
          <input type="hidden" name="type" value={type} />

          {/* Quantity */}
          <div>
            <label className="label">จำนวน{isIn ? "ที่นำเข้า" : "ที่เบิก"}</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => adjustQty(-1)}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 hover:bg-slate-100 transition-colors"
              >
                <Minus size={16} />
              </button>
              <input
                ref={qtyRef}
                name="quantity"
                type="number"
                defaultValue={1}
                min={1}
                max={isIn ? undefined : product.totalStock}
                required
                className="input text-center text-lg font-bold h-10 flex-1"
              />
              <button
                type="button"
                onClick={() => adjustQty(1)}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 hover:bg-slate-100 transition-colors"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="label">เหตุผล</label>
            <select name="reason" required className="input">
              <option value="">-- เลือกเหตุผล --</option>
              {REASON_OPTIONS[type].map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Department */}
          <div>
            <label className="label" htmlFor="departmentId">แผนก</label>
            <select id="departmentId" name="departmentId" className="input" defaultValue="">
              <option value="">-- ไม่ระบุ --</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Receiver (OUT only) */}
          {!isIn && (
            <div>
              <label className="label" htmlFor="receiver">ผู้รับ</label>
              <input
                id="receiver"
                name="receiver"
                className="input"
                placeholder="ชื่อผู้รับสินค้า"
                required
              />
              {state.errors?.receiver?.[0] && (
                <p className="mt-1 text-xs text-red-600">{state.errors.receiver[0]}</p>
              )}
            </div>
          )}

          {/* Note */}
          <div>
            <label className="label">
              หมายเหตุเพิ่มเติม <span className="text-slate-400 font-normal">(ไม่บังคับ)</span>
            </label>
            <textarea
              name="note"
              rows={2}
              placeholder="ระบุรายละเอียดเพิ่มเติม..."
              className="input resize-none"
            />
          </div>

          {/* Status Message */}
          {state.message && (
            <p
              className={clsx(
                "text-sm font-medium rounded-lg px-3 py-2",
                state.success
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              )}
            >
              {state.success ? "✅ " : "❌ "}{state.message}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={pending}
              className={clsx(
                "flex-1 rounded-lg px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all",
                isIn
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-red-500 hover:bg-red-600",
                pending && "opacity-60 cursor-not-allowed"
              )}
            >
              {pending ? "กำลังบันทึก..." : isIn ? "บันทึกการนำเข้า" : "บันทึกการเบิก"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
