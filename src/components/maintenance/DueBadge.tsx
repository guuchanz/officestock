"use client";

import { useTranslations } from "next-intl";
import { clsx } from "clsx";
import type { DueBucket } from "@/lib/maintenance-constants";

const TONE: Record<DueBucket, string> = {
  OVERDUE:   "bg-red-100 text-red-700",
  DUE_SOON:  "bg-amber-100 text-amber-700",
  SCHEDULED: "bg-green-100 text-green-700",
  INACTIVE:  "bg-slate-100 text-slate-500",
};

interface Props {
  bucket: DueBucket;
  remaining: number;
}

export default function DueBadge({ bucket, remaining }: Props) {
  const t = useTranslations("Maintenance");

  const label =
    bucket === "INACTIVE"
      ? t("inactive")
      : remaining < 0
        ? t("overdueDays", { days: Math.abs(remaining) })
        : t("remainingDays", { days: remaining });

  return (
    <span className={clsx("inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", TONE[bucket])}>
      {label}
    </span>
  );
}
