"use client";

import { useTransition } from "react";
import { ProjectStatus } from "@prisma/client";
import { useTranslations } from "next-intl";
import { changeProjectStatusAction } from "@/actions/project.actions";
import { TRANSITIONS } from "@/lib/project-constants";

export default function ProjectStatusSelect({
  id,
  status,
}: {
  id: number;
  status: ProjectStatus;
}) {
  const t = useTranslations("Projects");
  const [pending, start] = useTransition();
  const allowed = TRANSITIONS[status];

  return (
    <select
      className="input w-auto"
      value={status}
      disabled={pending || allowed.length === 0}
      onChange={(e) =>
        start(async () => {
          const res = await changeProjectStatusAction(id, e.target.value as ProjectStatus);
          if (!res.success) alert(res.message);
        })
      }
    >
      <option value={status}>{t(`status${status}`)}</option>
      {allowed.map((s) => (
        <option key={s} value={s}>{t(`status${s}`)}</option>
      ))}
    </select>
  );
}
