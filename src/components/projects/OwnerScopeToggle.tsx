"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { clsx } from "clsx";

/**
 * Same "mine" <-> "all owners" toggle as ProjectFilters, factored out so the
 * overview page (which has no other filters) doesn't need the full filter
 * bar just for this one control.
 */
export default function OwnerScopeToggle({
  isMine,
  basePath,
}: {
  isMine: boolean;
  basePath: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const t = useTranslations("ProjectFilters");

  function toggle() {
    const next = new URLSearchParams(params.toString());
    if (isMine) next.set("ownerId", "all");
    else next.delete("ownerId");
    router.push(`${basePath}?${next.toString()}`);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={clsx(
        "rounded-lg px-3 py-2 text-sm font-medium border transition-colors",
        isMine
          ? "bg-[#1e3a5f] text-white border-[#1e3a5f]"
          : "text-slate-600 border-slate-200 hover:bg-slate-50"
      )}
    >
      {isMine ? t("allProjects") : t("myProjects")}
    </button>
  );
}
