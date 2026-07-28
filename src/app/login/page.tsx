import { signIn } from "@/lib/auth";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getTranslations } from "next-intl/server";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session) redirect("/dashboard");

  const params = await searchParams;
  const error = params.error;
  const t = await getTranslations("Login");

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="card w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1e3a5f] text-white text-2xl font-bold mb-4">
            📦
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Department System</h1>
          <p className="text-slate-500 text-sm mt-1">{t("subtitle")}</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            ❌ {t("invalidCredentials")}
          </div>
        )}

        <form
          action={async (formData: FormData) => {
            "use server";
            try {
              await signIn("credentials", {
                email: formData.get("email"),
                password: formData.get("password"),
                redirectTo: "/dashboard",
              });
            } catch (e: any) {
              // NextAuth throws a redirect on success, rethrow it
              if (e?.message === "NEXT_REDIRECT") throw e;
              redirect("/login?error=CredentialsSignin");
            }
          }}
          className="space-y-4"
        >
          <div>
            <label className="label" htmlFor="email">{t("emailLabel")}</label>
            <input
              id="email" name="email" type="email"
              placeholder="admin@company.com"
              required
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="password">{t("passwordLabel")}</label>
            <input
              id="password" name="password" type="password"
              placeholder="••••••••"
              required
              className="input"
            />
          </div>
          <button type="submit" className="btn-primary w-full justify-center py-2.5">
            {t("submit")}
          </button>
        </form>

        <p className="text-center text-xs text-slate-400 mt-6">
          Demo: admin@company.com / admin1234
        </p>
      </div>
    </div>
  );
}
