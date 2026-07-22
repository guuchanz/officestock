"use client";

import { useEffect, useState, useActionState, useTransition } from "react";
import { clsx } from "clsx";
import { useTranslations, useLocale } from "next-intl";
import { Pencil, Trash2, Check, X, KeyRound } from "lucide-react";
import { Role } from "@prisma/client";
import {
  updateUserAction,
  resetUserPasswordAction,
  deleteUserAction,
  type UserActionState,
} from "@/actions/user.actions";

interface UserRowProps {
  user: {
    id:                string;
    name:               string | null;
    email:              string;
    role:               Role;
    mustResetPassword:  boolean;
    createdAt:          Date;
  };
  isSelf: boolean;
  canManage: boolean;
}

const initState: UserActionState = { success: false, message: "" };

function roleLabel(role: Role, tu: ReturnType<typeof useTranslations>) {
  if (role === "ADMIN") return tu("roleAdmin");
  if (role === "MODERATOR") return tu("roleModerator");
  return tu("roleStaff");
}

export default function UserRow({ user, isSelf, canManage }: UserRowProps) {
  const t     = useTranslations("UserRow");
  const tc    = useTranslations("Common");
  const tu    = useTranslations("Users");
  const locale = useLocale();

  const [mode, setMode] = useState<"view" | "edit" | "reset">("view");
  const [name, setName] = useState(user.name ?? "");
  const [role, setRole] = useState(user.role);

  const [editState, editAction, editPending]   = useActionState(updateUserAction, initState);
  const [resetState, resetAction, resetPending] = useActionState(resetUserPasswordAction, initState);
  const [isDeleting, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    if (editState.success) setMode("view");
  }, [editState]);

  useEffect(() => {
    if (resetState.success) setMode("view");
  }, [resetState]);

  const handleDelete = () => {
    if (!window.confirm(t("confirmDelete", { name: user.name ?? user.email }))) return;
    setDeleteError("");
    startDelete(async () => {
      const res = await deleteUserAction(user.id);
      if (!res.success) setDeleteError(res.message);
    });
  };

  if (mode === "edit") {
    return (
      <tr className="border-b border-slate-100">
        <td colSpan={6} className="px-5 py-3">
          <form action={editAction} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="id" value={user.id} />
            <input
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input flex-1 min-w-[160px]"
              placeholder={user.email}
              disabled={editPending}
            />
            <select
              name="role"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="input w-40"
              disabled={editPending}
            >
              <option value={Role.STAFF}>{tu("roleStaff")}</option>
              <option value={Role.MODERATOR}>{tu("roleModerator")}</option>
              <option value={Role.ADMIN}>{tu("roleAdmin")}</option>
            </select>
            <button
              type="submit"
              disabled={editPending}
              className={clsx("btn-ghost p-1.5 text-green-600", editPending && "opacity-60 cursor-not-allowed")}
              title={tc("save")}
            >
              <Check size={16} />
            </button>
            <button
              type="button"
              onClick={() => setMode("view")}
              className="btn-ghost p-1.5 text-slate-400"
              title={tc("cancel")}
            >
              <X size={16} />
            </button>
          </form>
          {editState.message && !editState.success && (
            <p className="mt-1 text-xs text-red-600">{editState.message}</p>
          )}
        </td>
      </tr>
    );
  }

  if (mode === "reset") {
    return (
      <tr className="border-b border-slate-100">
        <td colSpan={6} className="px-5 py-3">
          <form action={resetAction} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="id" value={user.id} />
            <input
              name="password"
              type="text"
              required
              minLength={6}
              autoFocus
              className="input flex-1 min-w-[160px]"
              placeholder={t("newPasswordPlaceholder")}
              disabled={resetPending}
            />
            <button
              type="submit"
              disabled={resetPending}
              className={clsx("btn-primary py-1.5", resetPending && "opacity-60 cursor-not-allowed")}
            >
              {resetPending ? tc("saving") : t("resetPasswordSubmit")}
            </button>
            <button
              type="button"
              onClick={() => setMode("view")}
              className="btn-ghost p-1.5 text-slate-400"
              title={tc("cancel")}
            >
              <X size={16} />
            </button>
          </form>
          {resetState.message && !resetState.success && (
            <p className="mt-1 text-xs text-red-600">{resetState.message}</p>
          )}
        </td>
      </tr>
    );
  }

  return (
    <tr className="hover:bg-slate-50/70 transition-colors">
      <td className="px-5 py-3.5 font-medium text-slate-800">{user.name ?? "—"}</td>
      <td className="px-4 py-3.5 text-slate-500">{user.email}</td>
      <td className="px-4 py-3.5 text-slate-600">{roleLabel(user.role, tu)}</td>
      <td className="px-4 py-3.5">
        <span
          className={clsx(
            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
            user.mustResetPassword ? "badge-warn" : "badge-ok"
          )}
        >
          {user.mustResetPassword ? tu("statusMustReset") : tu("statusActive")}
        </span>
      </td>
      <td className="px-4 py-3.5 text-xs text-slate-500">
        {new Date(user.createdAt).toLocaleDateString(locale === "en" ? "en-US" : "th-TH")}
      </td>
      <td className="px-5 py-3.5">
        {canManage ? (
          <div className="flex items-center justify-end gap-1">
            <button onClick={() => setMode("edit")} className="btn-ghost p-1.5" title={tc("edit")}>
              <Pencil size={14} />
            </button>
            <button onClick={() => setMode("reset")} className="btn-ghost p-1.5 text-amber-600" title={t("resetPassword")}>
              <KeyRound size={14} />
            </button>
            {!isSelf && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className={clsx("btn-ghost p-1.5 text-red-500", isDeleting && "opacity-60 cursor-not-allowed")}
                title={tc("delete")}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ) : (
          <p className="text-right text-slate-300">—</p>
        )}
        {deleteError && <p className="mt-1 text-xs text-red-600 text-right">{deleteError}</p>}
      </td>
    </tr>
  );
}
