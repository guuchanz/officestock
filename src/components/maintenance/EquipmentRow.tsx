"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil, Trash2, Wrench } from "lucide-react";
import { deleteEquipmentAction, type EquipmentListItem } from "@/actions/equipment.actions";
import DueBadge from "./DueBadge";

export default function EquipmentRow({ item }: { item: EquipmentListItem }) {
  const t = useTranslations("Maintenance");
  const tc = useTranslations("Common");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    if (!confirm(t("confirmDelete", { assetNo: item.assetNo, count: item._count.logs }))) return;
    setDeleting(true);
    setError("");
    const res = await deleteEquipmentAction(item.id);
    if (!res.success) setError(res.message);
    setDeleting(false);
  }

  return (
    <tr className="hover:bg-slate-50 align-top">
      <td className="px-5 py-3 font-mono text-xs text-slate-700 whitespace-nowrap">{item.assetNo}</td>
      <td className="px-4 py-3">
        <Link href={`/maintenance/${item.id}`} className="font-medium text-slate-800 hover:text-blue-600">
          {item.name}
        </Link>
        {item.model && <span className="text-slate-400 font-normal"> · {item.model}</span>}
        {item.serialNo && (
          <p className="text-[11px] text-slate-400 font-mono">S/N {item.serialNo}</p>
        )}
      </td>
      <td className="px-4 py-3 text-slate-600">
        {item.factory?.name ?? "-"}
        {item.area && <span className="block text-xs text-slate-400">{item.area.name}</span>}
      </td>
      <td className="px-4 py-3 text-slate-600">{item.technician?.name ?? "-"}</td>
      <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-center">
        {t("everyMonths", { months: item.intervalMonths })}
      </td>
      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
        {item.lastDoneAt ? new Date(item.lastDoneAt).toLocaleDateString("th-TH") : "-"}
        <span className="block text-xs text-slate-400">
          {t("nextShort")} {new Date(item.nextDueAt).toLocaleDateString("th-TH")}
        </span>
      </td>
      <td className="px-4 py-3">
        <DueBadge bucket={item.bucket} remaining={item.remaining} />
      </td>
      <td className="px-5 py-3 text-right whitespace-nowrap">
        <Link href={`/maintenance/${item.id}`} className="inline-block p-1.5 text-slate-400 hover:text-emerald-600" title={t("recordService")}>
          <Wrench size={15} />
        </Link>
        <Link href={`/maintenance/${item.id}/edit`} className="inline-block p-1.5 text-slate-400 hover:text-blue-600" title={tc("edit")}>
          <Pencil size={15} />
        </Link>
        <button onClick={handleDelete} disabled={deleting} className="p-1.5 text-slate-400 hover:text-red-600 disabled:opacity-50" title={tc("delete")}>
          <Trash2 size={15} />
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </td>
    </tr>
  );
}
