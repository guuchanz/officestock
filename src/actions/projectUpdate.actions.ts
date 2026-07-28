"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { saveUpload } from "@/lib/uploads";
import { pairFilesWithNames, type PendingAttachment } from "@/lib/attachments";
import { recalcProject } from "@/lib/projects";
import type { ProjectActionState } from "./project.actions";

// Same policy as RepairAttachment, from the same reasoning: PDF only.
const EXT_FOR_MIME: Record<string, string> = {
  "application/pdf": ".pdf",
};
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

class AttachmentError extends Error {}

function readFiles(formData: FormData): PendingAttachment[] {
  // One `docNames` input is rendered per selected file, in FileList order,
  // so the two arrays line up by index.
  return pairFilesWithNames(formData.getAll("files"), formData.getAll("docNames"));
}

async function assertAttachmentsValid(pending: PendingAttachment[]) {
  const t = await getTranslations("ProjectActions");
  for (const { file } of pending) {
    if (!EXT_FOR_MIME[file.type]) throw new AttachmentError(t("fileTypeError"));
    if (file.size > MAX_FILE_SIZE) throw new AttachmentError(t("fileTooLarge"));
  }
}

/**
 * Writes the files to disk and the rows to the DB. `updateId` is null for
 * project-level documents and set for files posted with an update entry.
 */
async function saveAttachments(
  tx: Prisma.TransactionClient,
  pending: PendingAttachment[],
  projectId: number,
  updateId: number | null,
  userId: string
) {
  for (const { file, docName } of pending) {
    const ext = EXT_FOR_MIME[file.type];
    const url = await saveUpload(file, "projects", ext);
    await tx.projectAttachment.create({
      data: {
        projectId,
        updateId,
        docName,
        fileUrl:      url,
        fileName:     file.name,
        mimeType:     file.type,
        uploadedById: userId,
      },
    });
  }
}

const updateSchema = z.object({
  note: z.string().min(1),
  cost: z.number().min(0),
});

export async function addUpdateAction(
  projectId: number,
  _prev: ProjectActionState,
  formData: FormData
): Promise<ProjectActionState> {
  const session = await auth();
  const t = await getTranslations("ProjectActions");
  const userId = session?.user?.id;
  if (!userId) return { success: false, message: t("loginRequired") };

  const costRaw = formData.get("cost");
  const parsed = updateSchema.safeParse({
    note: formData.get("note") ?? "",
    cost: costRaw === null || costRaw === "" ? 0 : Number(costRaw),
  });
  if (!parsed.success) return { success: false, message: t("noteRequired") };

  const pending = readFiles(formData);
  try {
    await assertAttachmentsValid(pending);
  } catch (e) {
    if (e instanceof AttachmentError) return { success: false, message: e.message };
    throw e;
  }

  await prisma.$transaction(async (tx) => {
    const created = await tx.projectUpdate.create({
      data: {
        projectId,
        note:        parsed.data.note,
        cost:        parsed.data.cost,
        createdById: userId,
      },
    });
    await saveAttachments(tx, pending, projectId, created.id, userId);
    // The new cost row changes actualCost.
    await recalcProject(tx, projectId);
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  revalidatePath("/projects/overview");
  return { success: true, message: t("updateAdded") };
}

export async function deleteUpdateAction(id: number): Promise<ProjectActionState> {
  const session = await auth();
  const t = await getTranslations("ProjectActions");
  if (!session?.user) return { success: false, message: t("loginRequired") };

  const existing = await prisma.projectUpdate.findUnique({ where: { id } });
  if (!existing) return { success: false, message: t("notFound") };

  await prisma.$transaction(async (tx) => {
    // Attachments cascade from the schema.
    await tx.projectUpdate.delete({ where: { id } });
    await recalcProject(tx, existing.projectId);
  });

  revalidatePath(`/projects/${existing.projectId}`);
  revalidatePath("/projects");
  return { success: true, message: t("deleteSuccess") };
}

/** Project-level documents: no update row, `updateId` stays null. */
export async function addProjectFilesAction(
  projectId: number,
  _prev: ProjectActionState,
  formData: FormData
): Promise<ProjectActionState> {
  const session = await auth();
  const t = await getTranslations("ProjectActions");
  const userId = session?.user?.id;
  if (!userId) return { success: false, message: t("loginRequired") };

  const pending = readFiles(formData);
  if (pending.length === 0) return { success: false, message: t("noFiles") };

  try {
    await assertAttachmentsValid(pending);
  } catch (e) {
    if (e instanceof AttachmentError) return { success: false, message: e.message };
    throw e;
  }

  await prisma.$transaction(async (tx) => {
    await saveAttachments(tx, pending, projectId, null, userId);
  });

  revalidatePath(`/projects/${projectId}`);
  return { success: true, message: t("filesAdded") };
}

export async function deleteProjectAttachmentAction(id: number): Promise<ProjectActionState> {
  const session = await auth();
  const t = await getTranslations("ProjectActions");
  if (!session?.user) return { success: false, message: t("loginRequired") };

  const existing = await prisma.projectAttachment.findUnique({ where: { id } });
  if (!existing) return { success: false, message: t("notFound") };

  await prisma.projectAttachment.delete({ where: { id } });

  revalidatePath(`/projects/${existing.projectId}`);
  return { success: true, message: t("deleteSuccess") };
}
