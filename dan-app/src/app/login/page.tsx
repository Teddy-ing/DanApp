import { auth, signIn } from "@/auth";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/returns");
  }

  const enableTestUser = process.env.AUTH_ENABLE_TEST_USER === "true";

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <section className="rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-neutral-900 shadow-sm p-6">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Log in to continue
          </h1>
          <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
            Access DRIP-adjusted returns with your Google account. You can manage your RapidAPI key after signing in.
          </p>
          <form
            className="mt-6"
            action={async () => {
              "use server";
              await signIn("google", {
                redirectTo: "/returns",
                prompt: "select_account",
              });
            }}
          >
            <button className="w-full inline-flex items-center justify-center rounded-md bg-indigo-600 text-white px-4 py-2.5 text-sm font-medium hover:bg-indigo-700 transition">
              Continue with Google
            </button>
          </form>
          {enableTestUser ? (
            <form
              className="mt-3"
              action={async () => {
                "use server";
                await signIn("test-user", {
                  redirectTo: "/returns",
                });
              }}
            >
              <button className="w-full inline-flex items-center justify-center rounded-md border border-indigo-200 text-indigo-700 dark:text-indigo-300 dark:border-indigo-400/60 px-4 py-2.5 text-sm font-medium hover:bg-indigo-50 dark:hover:bg-indigo-950 transition">
                Continue as Test User
              </button>
            </form>
          ) : null}
          <p className="mt-4 text-xs text-gray-600 dark:text-gray-400">
            By continuing, you agree to{" "}
            <a href="/terms" className="text-indigo-600 dark:text-indigo-400 hover:underline">
              the Terms of Service
            </a>{" "}
            and{" "}
            <a href="/privacy" className="text-indigo-600 dark:text-indigo-400 hover:underline">
              Privacy Policy
            </a>{" "}
            of The RND Group.
          </p>
        </section>
      </div>
    </div>
  );
}

