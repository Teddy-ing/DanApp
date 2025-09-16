import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const googleClientId =
  process.env.AUTH_GOOGLE_ID ??
  process.env.GOOGLE_ID ??
  process.env.GOOGLE_CLIENT_ID ??
  "missing";
const googleClientSecret =
  process.env.AUTH_GOOGLE_SECRET ??
  process.env.GOOGLE_SECRET ??
  process.env.GOOGLE_CLIENT_SECRET ??
  "missing";
const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;

// Debug logs removed after verification

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret,
  trustHost: true,
  session: { strategy: "jwt" },
  callbacks: {
    async session({ session, token }) {
      // Expose a stable user id on the session object for server routes
      if (session.user) {
        (session.user as { id?: string }).id = token.sub ?? undefined;
      }
      return session;
    },
  },
  providers: [
    Google({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
    }),
  ],
  cookies: {
    sessionToken: {
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
});


