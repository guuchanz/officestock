"use client";

import { useEffect, useActionState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { clsx } from "clsx";
import { createProductAction, updateProductAction, type ProductActionState } from "@/actions/product.actions";

interface ProductFormProps {
  categories: { id: number; name: string }[];
  product?: {
    id:         number;
    code:       string;
    name:       string;
    categoryId: number;
    minStock:   number;
    location:   string | null;
    unit:       string | null;
    unitPrice:  number | null;
    image:      string | null;
  };
}

const initState: ProductActionState = { success: false, message: "" };

export default function ProductForm({ categories, product }: ProductFormProps) {
  const isEdit = !!product;
  const [state, formAction, pending] = useActionState(
    isEdit ? updateProductAction : createProductAction,
    initState
  );
  const router = useRouter();

  useEffect(() => {
    if (state.success) router.push("/products");
  }, [state.success, router]);

  const fieldError = (field: string) => state.errors?.[field]?.[0];

  return (
    <form action={formAction} className="space-y-5">
      {isEdit && <input type="hidden" name="id" value={product.id} />}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="code">รหัสสินค้า (SKU)</label>
          <input id="code" name="code" className="input" placeholder="MS-001" defaultValue={product?.code} required />
          {fieldError("code") && <p className="mt-1 text-xs text-red-600">{fieldError("code")}</p>}
        </div>
        <div>
          <label className="label" htmlFor="categoryId">หมวดหมู่</label>
          <select id="categoryId" name="categoryId" className="input" defaultValue={product?.categoryId ?? ""} required>
            <option value="">-- เลือก --</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {fieldError("categoryId") && <p className="mt-1 text-xs text-red-600">{fieldError("categoryId")}</p>}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="name">ชื่อสินค้า</label>
        <input id="name" name="name" className="input" placeholder="Logitech MX Master 3" defaultValue={product?.name} required />
        {fieldError("name") && <p className="mt-1 text-xs text-red-600">{fieldError("name")}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="minStock">จำนวนขั้นต่ำ (แจ้งเตือน)</label>
          <input id="minStock" name="minStock" type="number" min={0} defaultValue={product?.minStock ?? 5} className="input" />
          {fieldError("minStock") && <p className="mt-1 text-xs text-red-600">{fieldError("minStock")}</p>}
        </div>
        <div>
          <label className="label" htmlFor="location">สถานที่จัดเก็บ</label>
          <input id="location" name="location" className="input" placeholder="ตู้ A1" defaultValue={product?.location ?? ""} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="unit">หน่วยนับ</label>
          <input id="unit" name="unit" className="input" placeholder="ชิ้น, กล่อง, แพ็ค" defaultValue={product?.unit ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="unitPrice">ราคาต่อหน่วย</label>
          <input id="unitPrice" name="unitPrice" type="number" min={0} step="0.01" className="input" placeholder="0.00" defaultValue={product?.unitPrice ?? ""} />
          {fieldError("unitPrice") && <p className="mt-1 text-xs text-red-600">{fieldError("unitPrice")}</p>}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="image">
          รูปภาพสินค้า{isEdit && <span className="text-slate-400 font-normal"> (เลือกไฟล์ใหม่เพื่อเปลี่ยนรูป)</span>}
        </label>
        {isEdit && product?.image && (
          <Image
            src={product.image}
            alt={product.name}
            width={56}
            height={56}
            className="mb-2 h-14 w-14 rounded-lg object-cover border border-slate-200"
          />
        )}
        <input id="image" name="image" type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="input" />
      </div>

      {state.message && (
        <p
          className={clsx(
            "text-sm font-medium rounded-lg px-3 py-2",
            state.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          )}
        >
          {state.success ? "✅ " : "❌ "}{state.message}
        </p>
      )}

      <div className="pt-2 flex gap-3">
        <Link href="/products" className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors text-center">
          ยกเลิก
        </Link>
        <button type="submit" disabled={pending} className={clsx("btn-primary flex-1 justify-center py-2.5", pending && "opacity-60 cursor-not-allowed")}>
          {pending ? "กำลังบันทึก..." : isEdit ? "บันทึกการแก้ไข" : "เพิ่มสินค้า"}
        </button>
      </div>
    </form>
  );
}
