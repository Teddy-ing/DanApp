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

// TEMP DEBUG LOGS — remove after verification
// Only log non-sensitive configuration to verify what the runtime sees
if (process.env.NODE_ENV !== "development") {
  // Avoid logging secrets; show presence only
  console.log(
    "[auth][debug] Runtime config:",
    JSON.stringify(
      {
        AUTH_URL: process.env.AUTH_URL,
        NEXTAUTH_URL: process.env.NEXTAUTH_URL,
        NODE_ENV: process.env.NODE_ENV,
        trustHost: false,
        has_AUTH_SECRET: Boolean(process.env.AUTH_SECRET),
        has_NEXTAUTH_SECRET: Boolean(process.env.NEXTAUTH_SECRET),
        has_AUTH_GOOGLE_ID: Boolean(process.env.AUTH_GOOGLE_ID),
        has_AUTH_GOOGLE_SECRET: Boolean(process.env.AUTH_GOOGLE_SECRET),
        has_GOOGLE_ID: Boolean(process.env.GOOGLE_ID),
        has_GOOGLE_SECRET: Boolean(process.env.GOOGLE_SECRET),
        has_GOOGLE_CLIENT_ID: Boolean(process.env.GOOGLE_CLIENT_ID),
        has_GOOGLE_CLIENT_SECRET: Boolean(process.env.GOOGLE_CLIENT_SECRET),
      },
      null,
      0
    )
  );
  try {
    const visibleKeys = Object.keys(process.env).filter(
      (k) => k.includes("GOOGLE") || k === "AUTH_SECRET" || k === "NEXTAUTH_SECRET"
    );
    console.log("[auth][debug] Present env keys (filtered):", visibleKeys);
  } catch {}
  try {
    console.log(
      "[auth][debug] Google provider presence:",
      JSON.stringify(
        {
          googleClientIdMissing: googleClientId === "missing",
          googleClientSecretMissing: googleClientSecret === "missing",
        },
        null,
        0
      )
    );
  } catch {}
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret,
  trustHost: false,
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


