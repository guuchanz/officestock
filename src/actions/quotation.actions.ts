"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { saveUpload } from "@/lib/uploads";

async function buildQuotationSchema() {
  const t = await getTranslations("QuotationActions");
  return z
    .object({
      qtNumber:     z.string().min(1, t("qtNumberRequired")),
      supplierName: z.string().min(1, t("supplierNameRequired")),
      description:  z.string().optional(),
      orderDate:    z.coerce.date({ errorMap: () => ({ message: t("orderDateRequired") }) }),
      receiveDate:  z.coerce.date().optional(),
      totalAmount:  z.number().min(0, t("totalAmountInvalid")),
    })
    .superRefine((data, ctx) => {
      if (data.receiveDate && data.receiveDate < data.orderDate) {
        ctx.addIssue({
          code:    z.ZodIssueCode.custom,
          path:    ["receiveDate"],
          message: t("receiveDateBeforeOrder"),
        });
      }
    });
}

const ALLOWED_PDF_TYPE = "application/pdf";
const MAX_PDF_SIZE = 10 * 1024 * 1024; // 10MB

class PdfTypeError extends Error {}

async function savePdfFile(file: File): Promise<{ url: string; name: string }> {
  const t = await getTranslations("QuotationActions");
  if (file.type !== ALLOWED_PDF_TYPE) {
    throw new PdfTypeError(t("pdfTypeError"));
  }
  if (file.size > MAX_PDF_SIZE) {
    throw new PdfTypeError(t("pdfTooLarge"));
  }

  const url = await saveUpload(file, "quotations", ".pdf");
  return { url, name: file.name };
}

export type QuotationActionState = {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
};

function readQuotationForm(formData: FormData) {
  const totalAmountRaw = formData.get("totalAmount") as string;
  const receiveDateRaw = (formData.get("receiveDate") as string) || undefined;

  return {
    qtNumber:     formData.get("qtNumber") as string,
    supplierName: formData.get("supplierName") as string,
    description:  (formData.get("description") as string) || undefined,
    orderDate:    formData.get("orderDate") as string,
    receiveDate:  receiveDateRaw,
    totalAmount:  totalAmountRaw ? Number(totalAmountRaw) : NaN,
  };
}

export async function createQuotationAction(
  _prev: QuotationActionState,
  formData: FormData
): Promise<QuotationActionState> {
  const session = await auth();
  const t = await getTranslations("QuotationActions");
  if (!session?.user?.id) return { success: false, message: t("loginRequired") };

  const quotationSchema = await buildQuotationSchema();
  const parsed = quotationSchema.safeParse(readQuotationForm(formData));
  if (!parsed.success) {
    return { success: false, message: t("invalidData"), errors: parsed.error.flatten().fieldErrors };
  }

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    return { success: false, message: t("fileRequired"), errors: { file: [t("fileRequired")] } };
  }

  try {
    const { url, name } = await savePdfFile(file);
    await prisma.quotation.create({
      data: {
        qtNumber:     parsed.data.qtNumber,
        supplierName: parsed.data.supplierName,
        description:  parsed.data.description ?? null,
        orderDate:    parsed.data.orderDate,
        receiveDate:  parsed.data.receiveDate ?? null,
        totalAmount:  parsed.data.totalAmount,
        fileUrl:      url,
        fileName:     name,
        uploadedById: session.user.id,
      },
    });
    revalidatePath("/quotations");
    return { success: true, message: t("createSuccess") };
  } catch (e: any) {
    if (e instanceof PdfTypeError) return { success: false, message: e.message };
    return { success: false, message: t("genericError") };
  }
}

export async function updateQuotationAction(
  _prev: QuotationActionState,
  formData: FormData
): Promise<QuotationActionState> {
  const session = await auth();
  const t = await getTranslations("QuotationActions");
  if (!session?.user) return { success: false, message: t("loginRequired") };

  const id = Number(formData.get("id"));
  if (!id) return { success: false, message: t("notFound") };

  const quotationSchema = await buildQuotationSchema();
  const parsed = quotationSchema.safeParse(readQuotationForm(formData));
  if (!parsed.success) {
    return { success: false, message: t("invalidData"), errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const file = formData.get("file") as File | null;
    const replacement = file && file.size > 0 ? await savePdfFile(file) : undefined;

    await prisma.quotation.update({
      where: { id },
      data: {
        qtNumber:     parsed.data.qtNumber,
        supplierName: parsed.data.supplierName,
        description:  parsed.data.description ?? null,
        orderDate:    parsed.data.orderDate,
        receiveDate:  parsed.data.receiveDate ?? null,
        totalAmount:  parsed.data.totalAmount,
        ...(replacement ? { fileUrl: replacement.url, fileName: replacement.name } : {}),
      },
    });
    revalidatePath("/quotations");
    return { success: true, message: t("updateSuccess") };
  } catch (e: any) {
    if (e.code === "P2025") return { success: false, message: t("notFound") };
    if (e instanceof PdfTypeError) return { success: false, message: e.message };
    return { success: false, message: t("genericError") };
  }
}

export async function deleteQuotationAction(id: number): Promise<QuotationActionState> {
  const session = await auth();
  const t = await getTranslations("QuotationActions");
  if (!session?.user) return { success: false, message: t("loginRequired") };

  try {
    await prisma.quotation.delete({ where: { id } });
    revalidatePath("/quotations");
    return { success: true, message: t("deleteSuccess") };
  } catch (e: any) {
    if (e.code === "P2025") return { success: false, message: t("notFound") };
    return { success: false, message: t("genericError") };
  }
}

export interface QuotationFilters {
  q?:    string;
  from?: string;
  to?:   string;
}

export async function getQuotations(filters: QuotationFilters = {}) {
  const { q, from, to } = filters;
  const where: any = {};

  if (q) {
    where.OR = [
      { qtNumber: { contains: q } },
      { supplierName: { contains: q } },
      { description: { contains: q } },
    ];
  }

  if (from || to) {
    where.orderDate = {};
    if (from) where.orderDate.gte = new Date(`${from}T00:00:00`);
    if (to) {
      const end = new Date(`${to}T00:00:00`);
      end.setDate(end.getDate() + 1);
      where.orderDate.lt = end;
    }
  }

  const quotations = await prisma.quotation.findMany({
    where,
    orderBy: { orderDate: "desc" },
    include: { uploadedBy: { select: { name: true, email: true } } },
  });
  return quotations.map((q) => ({ ...q, totalAmount: Number(q.totalAmount) }));
}

export async function getQuotationById(id: number) {
  const quotation = await prisma.quotation.findUnique({ where: { id } });
  if (!quotation) return null;
  return { ...quotation, totalAmount: Number(quotation.totalAmount) };
}
