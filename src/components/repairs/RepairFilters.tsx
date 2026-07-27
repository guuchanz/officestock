"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Search, Loader2 } from "lucide-react";
import { RepairStatus, RepairType } from "@prisma/client";

export default function RepairFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const t = useTranslations("RepairFilters");
  const tr = useTranslations("Repairs");

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    startTransition(() => router.push(`/repairs?${next.toString()}`));
  }

  return (
    <div className="flex flex-wrap items-end gap-3 p-4 border-b border-slate-100">
      <div className="relative flex-1 min-w-[200px]">
        <label className="label" htmlFor="q">{t("searchLabel")}</label>
        <Search size={15} className="absolute left-3 top-[38px] text-slate-400" />
        <input
          id="q" className="input pl-9" placeholder={t("searchPlaceholder")}
          defaultValue={params.get("q") ?? ""}
          onChange={(e) => update("q", e.target.value)}
        />
        {pending && <Loader2 size={15} className="absolute right-3 top-[38px] animate-spin text-slate-400" />}
      </div>

      <div className="min-w-[150px]">
        <label className="label" htmlFor="status">{t("statusLabel")}</label>
        <select id="status" className="input" defaultValue={params.get("status") ?? ""} onChange={(e) => update("status", e.target.value)}>
          <option value="">{t("allStatuses")}</option>
          {Object.values(RepairStatus).map((s) => (
            <option key={s} value={s}>{tr(`status${s}`)}</option>
          ))}
        </select>
      </div>

      <div className="min-w-[140px]">
        <label className="label" htmlFor="type">{t("typeLabel")}</label>
        <select id="type" className="input" defaultValue={params.get("type") ?? ""} onChange={(e) => update("type", e.target.value)}>
          <option value="">{t("allTypes")}</option>
          {Object.values(RepairType).map((v) => (
            <option key={v} value={v}>{tr(`type${v}`)}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="from">{t("fromLabel")}</label>
        <input id="from" type="date" className="input" defaultValue={params.get("from") ?? ""} onChange={(e) => update("from", e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="to">{t("toLabel")}</label>
        <input id="to" type="date" className="input" defaultValue={params.get("to") ?? ""} onChange={(e) => update("to", e.target.value)} />
      </div>
    </div>
  );
}
