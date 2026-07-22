import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl, auth: session } = req;
  const isLoggedIn        = !!session;
  const isAuthPage        = nextUrl.pathname.startsWith("/login");
  const isApiAuth         = nextUrl.pathname.startsWith("/api/auth");
  const isResetPasswordPage = nextUrl.pathname.startsWith("/reset-password");
  const mustResetPassword = !!(session?.user as any)?.mustResetPassword;

  if (isApiAuth) return NextResponse.next();
  if (!isLoggedIn && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }
  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }
  if (isLoggedIn && mustResetPassword && !isResetPasswordPage) {
    return NextResponse.redirect(new URL("/reset-password", nextUrl));
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|uploads|favicon.ico).*)"],
};
