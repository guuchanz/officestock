import { signIn } from "@/lib/auth";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session) redirect("/dashboard");

  const params = await searchParams;
  const error = params.error;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1e3a5f] via-blue-700 to-blue-500 flex items-center justify-center p-4">
      <div className="card w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1e3a5f] text-white text-2xl font-bold mb-4">
            📦
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Office Stock</h1>
          <p className="text-slate-500 text-sm mt-1">ระบบจัดการสต็อกอุปกรณ์สำนักงาน</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            ❌ อีเมลหรือรหัสผ่านไม่ถูกต้อง
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
            <label className="label" htmlFor="email">อีเมล</label>
            <input
              id="email" name="email" type="email"
              placeholder="admin@company.com"
              required
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="password">รหัสผ่าน</label>
            <input
              id="password" name="password" type="password"
              placeholder="••••••••"
              required
              className="input"
            />
          </div>
          <button type="submit" className="btn-primary w-full justify-center py-2.5">
            เข้าสู่ระบบ
          </button>
        </form>

        <p className="text-center text-xs text-slate-400 mt-6">
          Demo: admin@company.com / admin1234
        </p>
      </div>
    </div>
  );
}