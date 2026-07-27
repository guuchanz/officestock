"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Search, Loader2 } from "lucide-react";

const BUCKETS = ["OVERDUE", "DUE_SOON", "SCHEDULED", "INACTIVE"] as const;

interface Option { id: number; name: string }

interface Props {
  factories: Option[];
  areas: Option[];
}

export default function EquipmentFilters({ factories, areas }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const t = useTranslations("MaintenanceFilters");
  const tm = useTranslations("Maintenance");

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    startTransition(() => router.push(`/maintenance?${next.toString()}`));
  }

  return (
    <div className="grid gap-3 p-4 border-b border-slate-100 sm:grid-cols-2 lg:grid-cols-4">
      <div className="relative">
        <label className="label" htmlFor="q">{t("searchLabel")}</label>
        <Search size={15} className="absolute left-3 top-[38px] text-slate-400" />
        <input
          id="q" className="input pl-9" placeholder={t("searchPlaceholder")}
          defaultValue={params.get("q") ?? ""}
          onChange={(e) => update("q", e.target.value)}
        />
        {pending && <Loader2 size={15} className="absolute right-3 top-[38px] animate-spin text-slate-400" />}
      </div>

      <div>
        <label className="label" htmlFor="bucket">{t("statusLabel")}</label>
        <select id="bucket" className="input" defaultValue={params.get("bucket") ?? ""} onChange={(e) => update("bucket", e.target.value)}>
          <option value="">{t("all")}</option>
          {BUCKETS.map((b) => (
            <option key={b} value={b}>{tm(`bucket${b}`)}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="factoryId">{t("factoryLabel")}</label>
        <select id="factoryId" className="input" defaultValue={params.get("factoryId") ?? ""} onChange={(e) => update("factoryId", e.target.value)}>
          <option value="">{t("all")}</option>
          {factories.map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="areaId">{t("areaLabel")}</label>
        <select id="areaId" className="input" defaultValue={params.get("areaId") ?? ""} onChange={(e) => update("areaId", e.target.value)}>
          <option value="">{t("all")}</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
