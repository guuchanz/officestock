"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, X } from "lucide-react";
import { round2 } from "@/lib/parts";

export interface PartRow {
  name: string;
  cost: number;
}

interface Props {
  /** Existing rows when editing; empty on a new record. */
  defaultParts?: PartRow[];
  /** Fires with the parts subtotal so the parent can show a grand total. */
  onSubtotalChange?: (subtotal: number) => void;
}

/**
 * Repeatable name + cost rows, shared by Repair and Maintenance.
 *
 * Submits two parallel arrays, `partNames` and `partCosts`, rendered in the
 * same order — the server zips them by index via `pairParts()`, which drops
 * unnamed rows *after* zipping so a blank row cannot shift costs onto the
 * wrong part.
 */
export default function PartsEditor({ defaultParts = [], onSubtotalChange }: Props) {
  const t = useTranslations("Parts");
  const [parts, setParts] = useState<{ name: string; cost: string }[]>(
    defaultParts.map((p) => ({ name: p.name, cost: p.cost ? String(p.cost) : "" }))
  );

  const subtotalOf = (rows: { cost: string }[]) =>
    round2(rows.reduce((sum, p) => sum + (Number(p.cost) > 0 ? Number(p.cost) : 0), 0));

  function update(next: { name: string; cost: string }[]) {
    setParts(next);
    onSubtotalChange?.(subtotalOf(next));
  }

  const money = (n: number) =>
    n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="label mb-0">{t("label")}</span>
        <button
          type="button"
          onClick={() => update([...parts, { name: "", cost: "" }])}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50"
        >
          <Plus size={13} />{t("add")}
        </button>
      </div>

      {parts.length === 0 ? (
        <p className="py-2 text-center text-xs text-slate-400">{t("empty")}</p>
      ) : (
        <ul className="space-y-2">
          {parts.map((p, i) => (
            <li key={i} className="flex items-center gap-2">
              <input
                name="partNames"
                className="input flex-1 py-1.5"
                value={p.name}
                onChange={(e) =>
                  update(parts.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))
                }
                placeholder={t("namePlaceholder")}
                aria-label={t("nameLabel")}
              />
              <input
                name="partCosts"
                type="number" step="0.01" min="0"
                className="input w-28 py-1.5 text-right"
                value={p.cost}
                onChange={(e) =>
                  update(parts.map((x, k) => (k === i ? { ...x, cost: e.target.value } : x)))
                }
                placeholder="0.00"
                aria-label={t("costLabel")}
              />
              <button
                type="button"
                onClick={() => update(parts.filter((_, k) => k !== i))}
                className="p-1 text-slate-400 hover:text-red-600"
                title={t("remove")}
              >
                <X size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {parts.length > 0 && (
        <p className="mt-2 text-right text-xs text-slate-500">
          {t("subtotal", { amount: money(subtotalOf(parts)) })}
        </p>
      )}
    </div>
  );
}
