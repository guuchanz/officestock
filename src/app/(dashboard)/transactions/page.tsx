import { getTransactions } from "@/actions/product.actions";
import TransactionFilters from "@/components/transactions/TransactionFilters";
import { clsx } from "clsx";
import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";

export const revalidate = 0;

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const { q, from, to } = params;
  const { items, total, pages } = await getTransactions(page, 25, { q, from, to });

  const pageHref = (p: number) => {
    const sp = new URLSearchParams();
    sp.set("page", String(p));
    if (q) sp.set("q", q);
    if (from) sp.set("from", from);
    if (to) sp.set("to", to);
    return `/transactions?${sp.toString()}`;
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">ประวัติรายการ</h1>
        <p className="text-sm text-slate-500 mt-0.5">รายการเข้า-ออกสต็อกทั้งหมด ({total} รายการ)</p>
      </div>

      <div className="card overflow-hidden">
        <TransactionFilters q={q} from={from} to={to} />

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wide">
                <th className="px-5 py-3 font-medium">วันที่/เวลา</th>
                <th className="px-4 py-3 font-medium">ประเภท</th>
                <th className="px-4 py-3 font-medium">สินค้า</th>
                <th className="px-4 py-3 font-medium text-center">จำนวน</th>
                <th className="px-4 py-3 font-medium">เหตุผล</th>
                <th className="px-4 py-3 font-medium">ผู้รับ</th>
                <th className="px-4 py-3 font-medium">แผนก</th>
                <th className="px-4 py-3 font-medium">หมายเหตุ</th>
                <th className="px-5 py-3 font-medium">ผู้ทำรายการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-slate-400">
                    ยังไม่มีประวัติรายการ
                  </td>
                </tr>
              )}
              {items.map((tx) => {
                const isIn = tx.type === "IN";
                return (
                  <tr
                    key={tx.id}
                    className={clsx(
                      "hover:opacity-90 transition-opacity",
                      isIn ? "bg-green-50/30" : "bg-red-50/30"
                    )}
                  >
                    <td className="px-5 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(tx.createdAt).toLocaleDateString("th-TH", {
                        day: "2-digit", month: "short", year: "numeric",
                      })}
                      <br />
                      <span className="text-slate-400">
                        {new Date(tx.createdAt).toLocaleTimeString("th-TH", {
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </span>
                    </td>

                    <td className="px-4 py-3.5">
                      <span
                        className={clsx(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold",
                          isIn ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                        )}
                      >
                        {isIn
                          ? <ArrowDownCircle size={12} />
                          : <ArrowUpCircle size={12} />}
                        {isIn ? "นำเข้า" : "เบิกออก"}
                      </span>
                    </td>

                    <td className="px-4 py-3.5">
                      <p className="font-medium text-slate-800">{tx.product.name}</p>
                      <p className="text-xs font-mono text-slate-400">{tx.product.code}</p>
                    </td>

                    <td className="px-4 py-3.5 text-center">
                      <span
                        className={clsx(
                          "text-lg font-bold",
                          isIn ? "text-green-600" : "text-red-600"
                        )}
                      >
                        {isIn ? "+" : "-"}{tx.quantity}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-slate-600">{tx.reason}</td>
                    <td className="px-4 py-3.5 text-xs text-slate-600">{tx.receiver ?? "—"}</td>
                    <td className="px-4 py-3.5 text-xs text-slate-600">{tx.department?.name ?? "—"}</td>
                    <td className="px-4 py-3.5 text-xs text-slate-400">{tx.note ?? "—"}</td>
                    <td className="px-5 py-3.5 text-xs">
                      <p className="font-medium text-slate-700">{tx.operator.name}</p>
                      <p className="text-slate-400">{tx.operator.email}</p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-center gap-2 px-5 py-4 border-t border-slate-100">
            {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
              <a
                key={p}
                href={pageHref(p)}
                className={clsx(
                  "flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium transition-colors",
                  p === page
                    ? "bg-brand-600 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                )}
              >
                {p}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
