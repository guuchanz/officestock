"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcrypt";
import { z } from "zod";
import { Role } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { auth, signOut } from "@/lib/auth";

type AdminGate =
  | { error: string; session?: undefined }
  | { error?: undefined; session: Session };

async function requireAdmin(): Promise<AdminGate> {
  const session = await auth();
  const t = await getTranslations("UserActions");
  if (!session?.user) return { error: t("loginRequired") };
  if ((session.user as any).role !== "ADMIN") return { error: t("forbidden") };
  return { session };
}

// Admins and Moderators can both create users (Moderators are restricted to
// creating STAFF accounts — enforced below in createUserAction, not just in the UI).
async function requireUserManager(): Promise<AdminGate> {
  const session = await auth();
  const t = await getTranslations("UserActions");
  if (!session?.user) return { error: t("loginRequired") };
  const role = (session.user as any).role;
  if (role !== "ADMIN" && role !== "MODERATOR") return { error: t("forbidden") };
  return { session };
}

async function buildUserSchema() {
  const t = await getTranslations("UserActions");
  return z.object({
    email:    z.string().email(t("emailInvalid")),
    name:     z.string().optional(),
    role:     z.nativeEnum(Role),
    password: z.string().min(6, t("passwordMin")),
  });
}

export type UserActionState = {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
};

export async function getUsers() {
  return prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, role: true, mustResetPassword: true, createdAt: true },
  });
}

export async function createUserAction(
  _prev: UserActionState,
  formData: FormData
): Promise<UserActionState> {
  const gate = await requireUserManager();
  const t = await getTranslations("UserActions");
  if (gate.error) return { success: false, message: gate.error };

  const isAdmin = (gate.session!.user as any).role === "ADMIN";

  const userSchema = await buildUserSchema();
  const parsed = userSchema.safeParse({
    email:    formData.get("email") as string,
    name:     (formData.get("name") as string) || undefined,
    // Moderators can only create STAFF accounts — the submitted role is ignored
    // for them regardless of what the form sends, so this can't be bypassed client-side.
    role:     isAdmin ? (formData.get("role") as string) : Role.STAFF,
    password: formData.get("password") as string,
  });
  if (!parsed.success) {
    return { success: false, message: t("invalidData"), errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const hashed = await bcrypt.hash(parsed.data.password, 10);
    await prisma.user.create({
      data: {
        email:             parsed.data.email,
        name:              parsed.data.name ?? null,
        role:              parsed.data.role,
        password:          hashed,
        mustResetPassword: true,
      },
    });
    revalidatePath("/users");
    return { success: true, message: t("createSuccess") };
  } catch (e: any) {
    if (e.code === "P2002") return { success: false, message: t("duplicateEmail") };
    return { success: false, message: t("genericError") };
  }
}

export async function updateUserAction(
  _prev: UserActionState,
  formData: FormData
): Promise<UserActionState> {
  const gate = await requireAdmin();
  const t = await getTranslations("UserActions");
  if (gate.error) return { success: false, message: gate.error };

  const id = formData.get("id") as string;
  if (!id) return { success: false, message: t("notFound") };

  const nameRaw = (formData.get("name") as string) || undefined;
  const roleRaw = formData.get("role") as string;
  const parsed = z.object({ role: z.nativeEnum(Role) }).safeParse({ role: roleRaw });
  if (!parsed.success) {
    return { success: false, message: t("invalidData"), errors: parsed.error.flatten().fieldErrors };
  }

  try {
    await prisma.user.update({
      where: { id },
      data:  { name: nameRaw ?? null, role: parsed.data.role },
    });
    revalidatePath("/users");
    return { success: true, message: t("updateSuccess") };
  } catch (e: any) {
    if (e.code === "P2025") return { success: false, message: t("notFound") };
    return { success: false, message: t("genericError") };
  }
}

export async function resetUserPasswordAction(
  _prev: UserActionState,
  formData: FormData
): Promise<UserActionState> {
  const gate = await requireAdmin();
  const t = await getTranslations("UserActions");
  if (gate.error) return { success: false, message: gate.error };

  const id = formData.get("id") as string;
  if (!id) return { success: false, message: t("notFound") };

  const parsed = z.object({ password: z.string().min(6, t("passwordMin")) }).safeParse({
    password: formData.get("password") as string,
  });
  if (!parsed.success) {
    return { success: false, message: t("invalidData"), errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const hashed = await bcrypt.hash(parsed.data.password, 10);
    await prisma.user.update({
      where: { id },
      data:  { password: hashed, mustResetPassword: true },
    });
    revalidatePath("/users");
    return { success: true, message: t("resetSuccess") };
  } catch (e: any) {
    if (e.code === "P2025") return { success: false, message: t("notFound") };
    return { success: false, message: t("genericError") };
  }
}

export async function deleteUserAction(id: string): Promise<UserActionState> {
  const gate = await requireAdmin();
  const t = await getTranslations("UserActions");
  if (gate.error) return { success: false, message: gate.error };

  if (gate.session!.user!.id === id) {
    return { success: false, message: t("cannotDeleteSelf") };
  }

  try {
    await prisma.user.delete({ where: { id } });
    revalidatePath("/users");
    return { success: true, message: t("deleteSuccess") };
  } catch (e: any) {
    if (e.code === "P2025") return { success: false, message: t("notFound") };
    return { success: false, message: t("genericError") };
  }
}

export type ChangePasswordState = {
  success: boolean;
  message: string;
};

export async function changeOwnPasswordAction(
  _prev: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const session = await auth();
  const t = await getTranslations("UserActions");
  if (!session?.user?.id) return { success: false, message: t("loginRequired") };

  const password        = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  const parsed = z.object({ password: z.string().min(6, t("passwordMin")) }).safeParse({ password });
  if (!parsed.success) {
    return { success: false, message: parsed.error.errors[0]?.message ?? t("invalidData") };
  }
  if (password !== confirmPassword) {
    return { success: false, message: t("passwordMismatch") };
  }

  const hashed = await bcrypt.hash(password, 10);
  await prisma.user.update({
    where: { id: session.user.id },
    data:  { password: hashed, mustResetPassword: false },
  });

  await signOut({ redirectTo: "/login" });
  return { success: true, message: "" };
}
