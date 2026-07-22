import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getTranslations } from "next-intl/server";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";

export default async function ResetPasswordPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const t = await getTranslations("ResetPassword");

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1e3a5f] via-blue-700 to-blue-500 flex items-center justify-center p-4">
      <div className="card w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1e3a5f] text-white text-2xl font-bold mb-4">
            🔒
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{t("title")}</h1>
          <p className="text-slate-500 text-sm mt-1">{t("subtitle")}</p>
        </div>

        <ResetPasswordForm />
      </div>
    </div>
  );
}
