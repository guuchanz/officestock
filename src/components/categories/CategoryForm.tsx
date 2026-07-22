"use client";

import { useEffect, useRef, useActionState } from "react";
import { clsx } from "clsx";
import { useTranslations } from "next-intl";
import { createCategoryAction, type CategoryActionState } from "@/actions/category.actions";

const initState: CategoryActionState = { success: false, message: "" };

export default function CategoryForm() {
  const t  = useTranslations("CategoryForm");
  const tc = useTranslations("Common");
  const [state, formAction, pending] = useActionState(createCategoryAction, initState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  const fieldError = (field: string) => state.errors?.[field]?.[0];

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <label className="label" htmlFor="name">{t("nameLabel")}</label>
          <input id="name" name="name" className="input" placeholder={t("namePlaceholder")} required />
          {fieldError("name") && <p className="mt-1 text-xs text-red-600">{fieldError("name")}</p>}
        </div>
        <button
          type="submit"
          disabled={pending}
          className={clsx("btn-primary mt-6 py-2.5", pending && "opacity-60 cursor-not-allowed")}
        >
          {pending ? tc("saving") : t("add")}
        </button>
      </div>

      {state.message && (
        <p className={clsx("text-sm font-medium", state.success ? "text-green-700" : "text-red-600")}>
          {state.success ? "✅ " : "❌ "}{state.message}
        </p>
      )}
    </form>
  );
}
