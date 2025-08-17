import Link from "next/link";
import { auth } from "@/auth";
import KeyModal from "@/app/components/KeyModal";
import ExportButton from "@/app/components/ExportButton";
import InputsPanel from "@/app/components/InputsPanel";
import ReturnsShell from "@/app/components/ReturnsShell";

export default async function Home() {
  const session = await auth();
  if (!session?.user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-neutral-900 shadow-sm p-6">
          <div className="text-center mb-4">
            <h1 className="text-lg font-semibold">Sign in to continue</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Use your Google account to access the app.</p>
          </div>
          <Link href="/api/auth/signin" className="w-full inline-flex items-center justify-center rounded-md bg-black text-white dark:bg-white dark:text-black px-4 py-2.5 text-sm font-medium hover:opacity-90 transition">
            Sign in with Google
          </Link>
        </div>
      </div>
    );
  }
  return (
    <div className="font-sans grid grid-rows-[auto_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-6 sm:p-20">
      <header className="row-start-1 w-full flex items-center justify-between">
        <div className="text-sm text-gray-600 dark:text-gray-300">
          <span>Signed in as {session.user.email || session.user.name}</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <ExportButton />
          <KeyModal />
          <Link className="underline" href="/api/auth/signout">Sign out</Link>
        </div>
      </header>
      <main id="main-content" className="row-start-2 w-full">
        <ReturnsShell />
      </main>
      <footer className="row-start-3 w-full text-center text-xs text-gray-600 dark:text-gray-400 py-4">
        <p>
          Data provided by Yahoo Finance via RapidAPI. For informational purposes only. Not investment advice.
        </p>
      </footer>
    </div>
  );
}
