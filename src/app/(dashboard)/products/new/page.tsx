import { createProductAction } from "@/actions/product.actions";
import { getCategories } from "@/actions/product.actions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function NewProductPage() {
  const categories = await getCategories();

  return (
    <div className="max-w-xl space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/products" className="btn-ghost p-2">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">เพิ่มสินค้าใหม่</h1>
          <p className="text-sm text-slate-500">กรอกข้อมูลสินค้าที่ต้องการเพิ่มเข้าระบบ</p>
        </div>
      </div>

      <div className="card p-6">
        <form
          action={async (formData: FormData) => {
            "use server";
            const result = await createProductAction(null, formData);
            if (result.success) redirect("/products");
          }}
          className="space-y-5"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="code">รหัสสินค้า (SKU)</label>
              <input id="code" name="code" className="input" placeholder="MS-001" required />
            </div>
            <div>
              <label className="label" htmlFor="categoryId">หมวดหมู่</label>
              <select id="categoryId" name="categoryId" className="input" required>
                <option value="">-- เลือก --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="name">ชื่อสินค้า</label>
            <input id="name" name="name" className="input" placeholder="Logitech MX Master 3" required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="minStock">จำนวนขั้นต่ำ (แจ้งเตือน)</label>
              <input id="minStock" name="minStock" type="number" min={0} defaultValue={5} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="location">สถานที่จัดเก็บ</label>
              <input id="location" name="location" className="input" placeholder="ตู้ A1" />
            </div>
          </div>

          <div className="pt-2 flex gap-3">
            <Link href="/products" className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors text-center">
              ยกเลิก
            </Link>
            <button type="submit" className="btn-primary flex-1 justify-center py-2.5">
              เพิ่มสินค้า
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
