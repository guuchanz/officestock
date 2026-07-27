"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { clsx } from "clsx";
import { Trash2 } from "lucide-react";
import type { MaintResult } from "@prisma/client";
import { deleteMaintenanceLogAction } from "@/actions/maintenanceLog.actions";
import { round2 } from "@/lib/parts";

const RESULT_TONE: Record<MaintResult, string> = {
  OK:           "bg-green-100 text-green-700",
  FIXED:        "bg-blue-100 text-blue-700",
  NEEDS_REPAIR: "bg-amber-100 text-amber-700",
};

export interface ServiceLogItem {
  id: number;
  performedAt: Date;
  result: MaintResult;
  /** Legacy free-text field, shown only when a log has no part rows. */
  partsUsed: string | null;
  parts: { id: number; name: string; cost: number }[];
  labourCost: number;
  cost: number;
  note: string | null;
  technician: { name: string } | null;
}

export default function ServiceLogTable({ logs }: { logs: ServiceLogItem[] }) {
  const t = useTranslations("ServiceLog");
  const tc = useTranslations("Common");
  const [busy, setBusy] = useState<number | null>(null);
  const money = (n: number) =>
    n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const [error, setError] = useState("");

  async function handleDelete(id: number) {
    if (!confirm(t("confirmDelete"))) return;
    setBusy(id);
    setError("");
    const res = await deleteMaintenanceLogAction(id);
    if (!res.success) setError(res.message);
    setBusy(null);
  }

  if (logs.length === 0) {
    return <p className="py-10 text-center text-sm text-slate-400">{t("empty")}</p>;
  }

  // Totals across the asset's whole service history. The detail page loads
  // every log for the asset, so this is the lifetime cost, not a page subtotal.
  const totalParts  = round2(
    logs.reduce((sum, l) => sum + l.parts.reduce((s, p) => s + p.cost, 0), 0)
  );
  const totalLabour = round2(logs.reduce((sum, l) => sum + l.labourCost, 0));
  const grandTotal  = round2(logs.reduce((sum, l) => sum + l.cost, 0));

  return (
    <div className="overflow-x-auto">
      {error && <p className="px-5 py-2 text-xs text-red-600">{error}</p>}
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wide">
            <th className="px-5 py-3 font-medium">{t("colDate")}</th>
            <th className="px-4 py-3 font-medium">{t("colTechnician")}</th>
            <th className="px-4 py-3 font-medium">{t("colResult")}</th>
            <th className="px-4 py-3 font-medium">{t("colParts")}</th>
            <th className="px-4 py-3 font-medium text-right">{t("colCost")}</th>
            <th className="px-5 py-3 font-medium text-right">{t("colActions")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {logs.map((l) => (
            <tr key={l.id} className="hover:bg-slate-50 align-top">
              <td className="px-5 py-3 whitespace-nowrap text-slate-700">
                {new Date(l.performedAt).toLocaleDateString("th-TH")}
              </td>
              <td className="px-4 py-3 text-slate-600">{l.technician?.name ?? "-"}</td>
              <td className="px-4 py-3">
                <span className={clsx("rounded-full px-2.5 py-0.5 text-xs font-semibold", RESULT_TONE[l.result])}>
                  {t(`result${l.result}`)}
                </span>
              </td>
              <td className="px-4 py-3 text-slate-600">
                {l.parts.length > 0 ? (
                  <ul className="space-y-0.5">
                    {l.parts.map((p) => (
                      <li key={p.id} className="flex justify-between gap-3">
                        <span>{p.name}</span>
                        <span className="tabular-nums text-slate-400">{money(p.cost)}</span>
                      </li>
                    ))}
                    {l.labourCost > 0 && (
                      <li className="flex justify-between gap-3 text-slate-400">
                        <span>{t("labour")}</span>
                        <span className="tabular-nums">{money(l.labourCost)}</span>
                      </li>
                    )}
                  </ul>
                ) : (
                  l.partsUsed ?? "-"
                )}
                {l.note && <span className="block text-xs text-slate-400">{l.note}</span>}
              </td>
              <td className="px-4 py-3 text-right text-slate-700 whitespace-nowrap">
                {money(l.cost)}
              </td>
              <td className="px-5 py-3 text-right">
                <button
                  onClick={() => handleDelete(l.id)}
                  disabled={busy === l.id}
                  className="p-1.5 text-slate-400 hover:text-red-600 disabled:opacity-50"
                  title={tc("delete")}
                >
                  <Trash2 size={15} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-700">
            <td colSpan={3} className="px-5 py-3">
              {t("summaryLabel", { count: logs.length })}
            </td>
            <td className="px-4 py-3 text-xs font-normal text-slate-500">
              <span className="flex justify-between gap-3">
                <span>{t("colParts")}</span>
                <span className="tabular-nums">{money(totalParts)}</span>
              </span>
              <span className="flex justify-between gap-3">
                <span>{t("labour")}</span>
                <span className="tabular-nums">{money(totalLabour)}</span>
              </span>
            </td>
            <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
              {money(grandTotal)}
            </td>
            <td className="px-5 py-3" />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
