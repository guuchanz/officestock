import { RepairStatus } from "@prisma/client";
import { clsx } from "clsx";
import { useTranslations } from "next-intl";

const STYLES: Record<RepairStatus, string> = {
  RECEIVED:    "bg-indigo-100 text-indigo-700",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  DONE:        "bg-emerald-100 text-emerald-700",
  RETURNED:    "bg-slate-200 text-slate-600",
  CANCELLED:   "bg-red-100 text-red-700",
};

export default function RepairStatusBadge({ status }: { status: RepairStatus }) {
  const t = useTranslations("Repairs");
  return (
    <span className={clsx("inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", STYLES[status])}>
      {t(`status${status}`)}
    </span>
  );
}
