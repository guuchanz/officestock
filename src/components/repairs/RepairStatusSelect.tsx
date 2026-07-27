"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { RepairStatus } from "@prisma/client";
import { updateRepairStatusAction } from "@/actions/repair.actions";

export default function RepairStatusSelect({ id, status }: { id: number; status: RepairStatus }) {
  const t = useTranslations("Repairs");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  return (
    <div>
      <select
        className="input py-1 text-xs"
        value={status}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value as RepairStatus;
          setError("");
          startTransition(async () => {
            const res = await updateRepairStatusAction(id, next);
            if (!res.success) setError(res.message);
          });
        }}
      >
        {Object.values(RepairStatus).map((s) => (
          <option key={s} value={s}>{t(`status${s}`)}</option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
