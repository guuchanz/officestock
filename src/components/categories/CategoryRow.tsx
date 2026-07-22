"use client";

import { useEffect, useState, useActionState, useTransition } from "react";
import { clsx } from "clsx";
import { useTranslations } from "next-intl";
import { Pencil, Trash2, Check, X } from "lucide-react";
import {
  updateCategoryAction,
  deleteCategoryAction,
  type CategoryActionState,
} from "@/actions/category.actions";

interface CategoryRowProps {
  category: { id: number; name: string; _count: { products: number } };
}

const initState: CategoryActionState = { success: false, message: "" };

export default function CategoryRow({ category }: CategoryRowProps) {
  const t  = useTranslations("CategoryRow");
  const tc = useTranslations("Common");
  const [name, setName] = useState(category.name);
  const [editValue, setEditValue] = useState(category.name);
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updateCategoryAction, initState);
  const [isDeleting, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    if (state.success) {
      setName(editValue.trim());
      setEditing(false);
    }
  }, [state, editValue]);

  const startEditing = () => {
    setEditValue(name);
    setEditing(true);
  };

  const handleDelete = () => {
    if (!window.confirm(t("confirmDelete", { name }))) return;
    setDeleteError("");
    startDelete(async () => {
      const res = await deleteCategoryAction(category.id);
      if (!res.success) setDeleteError(res.message);
    });
  };

  if (editing) {
    return (
      <form action={formAction} className="px-4 py-3">
        <div className="flex items-center gap-2">
          <input type="hidden" name="id" value={category.id} />
          <input
            name="name"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            disabled={pending}
            className="input flex-1"
            autoFocus
            required
          />
          <button
            type="submit"
            disabled={pending}
            className={clsx("btn-ghost p-1.5 text-green-600", pending && "opacity-60 cursor-not-allowed")}
            title={tc("save")}
          >
            <Check size={16} />
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="btn-ghost p-1.5 text-slate-400"
            title={tc("cancel")}
          >
            <X size={16} />
          </button>
        </div>
        {state.message && !state.success && (
          <p className="mt-1 text-xs text-red-600">{state.message}</p>
        )}
      </form>
    );
  }

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-800">{name}</span>
        <div className="flex items-center gap-1">
          <span className="text-xs text-slate-400 mr-2">{t("productsCount", { count: category._count.products })}</span>
          <button onClick={startEditing} className="btn-ghost p-1.5" title={tc("edit")}>
            <Pencil size={14} />
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className={clsx("btn-ghost p-1.5 text-red-500", isDeleting && "opacity-60 cursor-not-allowed")}
            title={tc("delete")}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      {deleteError && <p className="mt-1 text-xs text-red-600">{deleteError}</p>}
    </div>
  );
}
