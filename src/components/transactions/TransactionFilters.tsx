"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Search, X, FileSpreadsheet } from "lucide-react";

interface TransactionFiltersProps {
  q?:    string;
  from?: string;
  to?:   string;
}

export default function TransactionFilters({ q, from, to }: TransactionFiltersProps) {
  const t          = useTranslations("TransactionFilters");
  const router     = useRouter();
  const pathname   = usePathname();
  const [, startT] = useTransition();

  const [search, setSearch] = useState(q ?? "");
  const [dateFrom, setDateFrom] = useState(from ?? "");
  const [dateTo, setDateTo] = useState(to ?? "");

  const applyFilters = (next: { q?: string; from?: string; to?: string }) => {
    const params = new URLSearchParams();
    if (next.q) params.set("q", next.q);
    if (next.from) params.set("from", next.from);
    if (next.to) params.set("to", next.to);
    startT(() => router.replace(`${pathname}?${params.toString()}`));
  };

  const handleSearch = (val: string) => {
    setSearch(val);
    applyFilters({ q: val, from: dateFrom, to: dateTo });
  };

  const handleFrom = (val: string) => {
    setDateFrom(val);
    applyFilters({ q: search, from: val, to: dateTo });
  };

  const handleTo = (val: string) => {
    setDateTo(val);
    applyFilters({ q: search, from: dateFrom, to: val });
  };

  const hasFilters = !!(search || dateFrom || dateTo);

  const clearFilters = () => {
    setSearch("");
    setDateFrom("");
    setDateTo("");
    startT(() => router.replace(pathname));
  };

  const exportHref = (() => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    const qs = params.toString();
    return `/api/transactions/export${qs ? `?${qs}` : ""}`;
  })();

  return (
    <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-slate-100">
      <div className="relative flex-1 min-w-[220px]">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="input pl-9 w-full text-xs"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => handleFrom(e.target.value)}
          max={dateTo || undefined}
          className="input text-xs"
        />
        <span className="text-xs text-slate-400">{t("to")}</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => handleTo(e.target.value)}
          min={dateFrom || undefined}
          className="input text-xs"
        />
      </div>

      {hasFilters && (
        <button
          onClick={clearFilters}
          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        >
          <X size={13} />
          {t("clearFilters")}
        </button>
      )}

      <a
        href={exportHref}
        className="flex items-center gap-1.5 rounded-lg bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-100 transition-colors"
      >
        <FileSpreadsheet size={14} />
        {t("exportExcel")}
      </a>
    </div>
  );
}
