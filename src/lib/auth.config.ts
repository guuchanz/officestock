import type { NextAuthConfig } from "next-auth";

// Edge-safe base config: no providers (Credentials needs bcrypt + Prisma, neither
// of which can run in the Edge Runtime that middleware executes in). Middleware
// builds a lightweight NextAuth instance from just this config; the full config
// with providers lives in auth.ts and is only ever used in Node.js contexts
// (Route Handlers, Server Components, Server Actions).
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id   = user.id;
        token.role = (user as any).role;
        token.mustResetPassword = (user as any).mustResetPassword;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id   = token.id as string;
        (session.user as any).role = token.role;
        (session.user as any).mustResetPassword = token.mustResetPassword;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
