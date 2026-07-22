"use client";

import { useActionState } from "react";
import { clsx } from "clsx";
import { useTranslations } from "next-intl";
import { changeOwnPasswordAction, type ChangePasswordState } from "@/actions/user.actions";

const initState: ChangePasswordState = { success: false, message: "" };

export default function ResetPasswordForm() {
  const t = useTranslations("ResetPassword");
  const [state, formAction, pending] = useActionState(changeOwnPasswordAction, initState);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="label" htmlFor="password">{t("newPasswordLabel")}</label>
        <input id="password" name="password" type="password" required minLength={6} className="input" autoFocus />
      </div>
      <div>
        <label className="label" htmlFor="confirmPassword">{t("confirmPasswordLabel")}</label>
        <input id="confirmPassword" name="confirmPassword" type="password" required minLength={6} className="input" />
      </div>

      {state.message && (
        <p className="text-sm font-medium rounded-lg px-3 py-2 bg-red-50 text-red-700">
          ❌ {state.message}
        </p>
      )}

      <button type="submit" disabled={pending} className={clsx("btn-primary w-full justify-center py-2.5", pending && "opacity-60 cursor-not-allowed")}>
        {t("submit")}
      </button>
    </form>
  );
}
