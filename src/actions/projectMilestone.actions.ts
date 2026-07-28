"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { dateOnly, recalcProject } from "@/lib/projects";
import type { ProjectActionState } from "./project.actions";

const milestoneSchema = z.object({
  name:      z.string().min(1),
  startDate: z.coerce.date().optional(),
  endDate:   z.coerce.date().optional(),
});

export async function addMilestoneAction(
  projectId: number,
  _prev: ProjectActionState,
  formData: FormData
): Promise<ProjectActionState> {
  const session = await auth();
  const t = await getTranslations("ProjectActions");
  if (!session?.user) return { success: false, message: t("loginRequired") };

  const str = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
  };

  const parsed = milestoneSchema.safeParse({
    name:      formData.get("name") ?? "",
    startDate: str("startDate"),
    endDate:   str("endDate"),
  });
  if (!parsed.success) {
    return { success: false, message: t("milestoneNameRequired") };
  }
  const d = parsed.data;

  if (d.startDate && d.endDate && d.endDate < d.startDate) {
    return { success: false, message: t("endBeforeStart") };
  }

  await prisma.$transaction(async (tx) => {
    const last = await tx.projectMilestone.findFirst({
      where: { projectId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    await tx.projectMilestone.create({
      data: {
        projectId,
        name:      d.name,
        startDate: d.startDate ? dateOnly(d.startDate) : null,
        endDate:   d.endDate ? dateOnly(d.endDate) : null,
        sortOrder: (last?.sortOrder ?? 0) + 10,
      },
    });
    // A new milestone changes the denominator, so progress moves even though
    // nothing was ticked.
    await recalcProject(tx, projectId);
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  return { success: true, message: t("milestoneAdded") };
}

export async function toggleMilestoneAction(id: number): Promise<ProjectActionState> {
  const session = await auth();
  const t = await getTranslations("ProjectActions");
  if (!session?.user) return { success: false, message: t("loginRequired") };

  const existing = await prisma.projectMilestone.findUnique({ where: { id } });
  if (!existing) return { success: false, message: t("notFound") };

  await prisma.$transaction(async (tx) => {
    await tx.projectMilestone.update({
      where: { id },
      data: {
        isDone: !existing.isDone,
        doneAt: existing.isDone ? null : new Date(),
      },
    });
    await recalcProject(tx, existing.projectId);
  });

  revalidatePath(`/projects/${existing.projectId}`);
  revalidatePath("/projects");
  return { success: true, message: t("updateSuccess") };
}

export async function deleteMilestoneAction(id: number): Promise<ProjectActionState> {
  const session = await auth();
  const t = await getTranslations("ProjectActions");
  if (!session?.user) return { success: false, message: t("loginRequired") };

  const existing = await prisma.projectMilestone.findUnique({ where: { id } });
  if (!existing) return { success: false, message: t("notFound") };

  await prisma.$transaction(async (tx) => {
    await tx.projectMilestone.delete({ where: { id } });
    await recalcProject(tx, existing.projectId);
  });

  revalidatePath(`/projects/${existing.projectId}`);
  revalidatePath("/projects");
  return { success: true, message: t("deleteSuccess") };
}
