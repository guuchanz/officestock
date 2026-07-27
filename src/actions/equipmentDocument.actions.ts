"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { saveUpload } from "@/lib/uploads";

/**
 * The document panel lives on the edit page; the detail page shows a count.
 * Both must refresh or an upload appears to do nothing until a hard reload.
 */
function revalidateDocuments(equipmentId: number) {
  revalidatePath(`/maintenance/${equipmentId}/edit`);
  revalidatePath(`/maintenance/${equipmentId}`);
}

export type EquipmentDocumentActionState = {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
};

// PDF only — see the note in repair.actions.ts about existing uploads.
const EXT_FOR_MIME: Record<string, string> = {
  "application/pdf": ".pdf",
};
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function uploadEquipmentDocumentAction(
  _prev: EquipmentDocumentActionState,
  formData: FormData
): Promise<EquipmentDocumentActionState> {
  const session = await auth();
  const t = await getTranslations("EquipmentDocumentActions");
  if (!session?.user?.id) return { success: false, message: t("loginRequired") };

  const equipmentId = Number(formData.get("equipmentId"));
  if (!equipmentId) return { success: false, message: t("notFound") };

  const schema = z.object({
    docName: z.string().min(1, t("docNameRequired")).max(191),
  });
  const parsed = schema.safeParse({
    docName: ((formData.get("docName") as string) ?? "").trim(),
  });
  if (!parsed.success) {
    return { success: false, message: t("invalidData"), errors: parsed.error.flatten().fieldErrors };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, message: t("fileRequired") };
  }

  // Validated before the upload is written and before any row is created, so a
  // rejected file leaves nothing behind on disk or in the database.
  const ext = EXT_FOR_MIME[file.type];
  if (!ext) return { success: false, message: t("fileTypeError") };
  if (file.size > MAX_FILE_SIZE) return { success: false, message: t("fileTooLarge") };

  try {
    const url = await saveUpload(file, "equipment", ext);
    await prisma.equipmentDocument.create({
      data: {
        equipmentId,
        docName:      parsed.data.docName,
        fileUrl:      url,
        fileName:     file.name,
        mimeType:     file.type,
        uploadedById: session.user.id,
      },
    });

    revalidateDocuments(equipmentId);
    return { success: true, message: t("uploadSuccess") };
  } catch (e: any) {
    if (e.code === "P2003") return { success: false, message: t("notFound") };
    return { success: false, message: t("genericError") };
  }
}

export async function renameEquipmentDocumentAction(
  id: number,
  docName: string
): Promise<EquipmentDocumentActionState> {
  const session = await auth();
  const t = await getTranslations("EquipmentDocumentActions");
  if (!session?.user) return { success: false, message: t("loginRequired") };

  const trimmed = docName.trim();
  if (!trimmed) return { success: false, message: t("docNameRequired") };

  try {
    const row = await prisma.equipmentDocument.update({
      where: { id },
      data: { docName: trimmed.slice(0, 191) },
    });
    revalidateDocuments(row.equipmentId);
    return { success: true, message: t("renameSuccess") };
  } catch (e: any) {
    if (e.code === "P2025") return { success: false, message: t("notFound") };
    return { success: false, message: t("genericError") };
  }
}

export async function deleteEquipmentDocumentAction(
  id: number
): Promise<EquipmentDocumentActionState> {
  const session = await auth();
  const t = await getTranslations("EquipmentDocumentActions");
  if (!session?.user) return { success: false, message: t("loginRequired") };

  try {
    // The row goes; the file stays on disk. Same as the repair module — an
    // orphaned upload is cheaper than deleting a file a restored row points at.
    const row = await prisma.equipmentDocument.delete({ where: { id } });
    revalidateDocuments(row.equipmentId);
    return { success: true, message: t("deleteSuccess") };
  } catch (e: any) {
    if (e.code === "P2025") return { success: false, message: t("notFound") };
    return { success: false, message: t("genericError") };
  }
}
