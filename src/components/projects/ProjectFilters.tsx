"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { PROJECT_STATUSES, PROJECT_PRIORITIES } from "@/lib/project-constants";

export default function ProjectFilters({
  departments,
}: {
  departments: { id: number; name: string }[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const t = useTranslations("ProjectFilters");
  const tp = useTranslations("Projects");

  function set(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/projects?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-2 border-b border-slate-100 p-4">
      <input
        className="input max-w-xs"
        placeholder={t("searchPlaceholder")}
        defaultValue={params.get("q") ?? ""}
        onChange={(e) => set("q", e.target.value)}
      />
      <select className="input w-auto" defaultValue={params.get("status") ?? ""}
              onChange={(e) => set("status", e.target.value)}>
        <option value="">{t("allStatuses")}</option>
        {PROJECT_STATUSES.map((s) => (
          <option key={s} value={s}>{tp(`status${s}`)}</option>
        ))}
      </select>
      <select className="input w-auto" defaultValue={params.get("priority") ?? ""}
              onChange={(e) => set("priority", e.target.value)}>
        <option value="">{t("allPriorities")}</option>
        {PROJECT_PRIORITIES.map((p) => (
          <option key={p} value={p}>{tp(`priority${p}`)}</option>
        ))}
      </select>
      <select className="input w-auto" defaultValue={params.get("departmentId") ?? ""}
              onChange={(e) => set("departmentId", e.target.value)}>
        <option value="">{t("allDepartments")}</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>{d.name}</option>
        ))}
      </select>
    </div>
  );
}
