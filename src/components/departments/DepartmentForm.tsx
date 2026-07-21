"use client";

import { useEffect, useRef, useActionState } from "react";
import { clsx } from "clsx";
import { createDepartmentAction, type DepartmentActionState } from "@/actions/department.actions";

const initState: DepartmentActionState = { success: false, message: "" };

export default function DepartmentForm() {
  const [state, formAction, pending] = useActionState(createDepartmentAction, initState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  const fieldError = (field: string) => state.errors?.[field]?.[0];

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <label className="label" htmlFor="name">ชื่อแผนก</label>
          <input id="name" name="name" className="input" placeholder="เช่น ฝ่ายบัญชี, ฝ่าย IT" required />
          {fieldError("name") && <p className="mt-1 text-xs text-red-600">{fieldError("name")}</p>}
        </div>
        <button
          type="submit"
          disabled={pending}
          className={clsx("btn-primary mt-6 py-2.5", pending && "opacity-60 cursor-not-allowed")}
        >
          {pending ? "กำลังบันทึก..." : "เพิ่มแผนก"}
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
