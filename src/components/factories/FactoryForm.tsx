"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { clsx } from "clsx";
import { PlusCircle } from "lucide-react";
import { createFactoryAction, type FactoryActionState } from "@/actions/factory.actions";

const initState: FactoryActionState = { success: false, message: "" };

export default function FactoryForm() {
  const t = useTranslations("FactoryForm");
  const tc = useTranslations("Common");
  const [state, formAction, pending] = useActionState(createFactoryAction, initState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3 p-4 border-b border-slate-100">
      <div className="flex-1 min-w-[200px]">
        <label className="label" htmlFor="name">{t("nameLabel")}</label>
        <input id="name" name="name" className="input" placeholder={t("namePlaceholder")} required />
      </div>
      <button type="submit" disabled={pending} className={clsx("btn-primary py-2.5", pending && "opacity-60 cursor-not-allowed")}>
        <PlusCircle size={16} />
        {pending ? tc("saving") : t("add")}
      </button>

      {state.message && (
        <p className={clsx(
          "w-full text-sm font-medium rounded-lg px-3 py-2",
          state.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
        )}>
          {state.success ? "✅ " : "❌ "}{state.message}
        </p>
      )}
    </form>
  );
}
