"use client";

import { useEffect, useRef, useActionState } from "react";
import { clsx } from "clsx";
import { useTranslations } from "next-intl";
import { Role } from "@prisma/client";
import { createUserAction, type UserActionState } from "@/actions/user.actions";

const initState: UserActionState = { success: false, message: "" };

interface UserFormProps {
  restrictToStaff?: boolean;
}

export default function UserForm({ restrictToStaff = false }: UserFormProps) {
  const t  = useTranslations("UserForm");
  const tc = useTranslations("Common");
  const tu = useTranslations("Users");
  const [state, formAction, pending] = useActionState(createUserAction, initState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  const fieldError = (field: string) => state.errors?.[field]?.[0];

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="email">{t("emailLabel")}</label>
          <input id="email" name="email" type="email" className="input" placeholder={t("emailPlaceholder")} required />
          {fieldError("email") && <p className="mt-1 text-xs text-red-600">{fieldError("email")}</p>}
        </div>
        <div>
          <label className="label" htmlFor="name">{t("nameLabel")}</label>
          <input id="name" name="name" className="input" placeholder={t("namePlaceholder")} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="role">{t("roleLabel")}</label>
          {restrictToStaff ? (
            <>
              <input type="hidden" name="role" value={Role.STAFF} />
              <p className="input flex items-center bg-slate-50 text-slate-500">{tu("roleStaff")}</p>
            </>
          ) : (
            <select id="role" name="role" className="input" defaultValue={Role.STAFF} required>
              <option value={Role.STAFF}>{tu("roleStaff")}</option>
              <option value={Role.MODERATOR}>{tu("roleModerator")}</option>
              <option value={Role.ADMIN}>{tu("roleAdmin")}</option>
            </select>
          )}
        </div>
        <div>
          <label className="label" htmlFor="password">{t("passwordLabel")}</label>
          <input id="password" name="password" type="text" className="input" required minLength={6} />
          {fieldError("password") && <p className="mt-1 text-xs text-red-600">{fieldError("password")}</p>}
        </div>
      </div>

      <p className="text-xs text-slate-400">{t("passwordHint")}</p>

      {state.message && (
        <p
          className={clsx(
            "text-sm font-medium rounded-lg px-3 py-2",
            state.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          )}
        >
          {state.success ? "✅ " : "❌ "}{state.message}
        </p>
      )}

      <button type="submit" disabled={pending} className={clsx("btn-primary", pending && "opacity-60 cursor-not-allowed")}>
        {pending ? tc("saving") : t("add")}
      </button>
    </form>
  );
}
