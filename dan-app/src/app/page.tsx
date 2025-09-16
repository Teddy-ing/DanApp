import Link from "next/link";
import { auth, signIn } from "@/auth";
import KeyModal from "@/app/components/KeyModal";
import ExportButton from "@/app/components/ExportButton";
import ReturnsShell from "@/app/components/ReturnsShell";
import { marketingCopy } from "@/lib/marketingCopy";

export default async function Home() {
  const session = await auth();
  if (!session?.user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-3xl">
          <header className="w-full flex items-center justify-between py-2">
            <nav className="text-sm text-gray-700 dark:text-gray-300">
              <ul className="flex items-center gap-4">
                <li><a className="hover:underline" href={marketingCopy.links.methodology}>Methodology</a></li>
                <li><a className="hover:underline" href={marketingCopy.links.reliability}>Reliability</a></li>
                <li><a className="hover:underline" href={marketingCopy.links.security}>Security</a></li>
                <li><a className="hover:underline" href={marketingCopy.links.faq}>FAQ</a></li>
                <li><a className="hover:underline" href={marketingCopy.links.pricing}>Pricing</a></li>
              </ul>
            </nav>
            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: "/", prompt: "select_account" });
              }}
            >
              <button className="inline-flex items-center justify-center rounded-md bg-indigo-600 text-white px-3 py-2 text-sm font-medium hover:bg-indigo-700 transition">
                {marketingCopy.ctas.primary}
              </button>
            </form>
          </header>
          <main id="main-content" className="mt-8">
            <section aria-labelledby="hero-heading" className="rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-neutral-900 shadow-sm p-6">
              <h1 id="hero-heading" className="text-2xl font-semibold tracking-tight">
                {marketingCopy.headline}
              </h1>
              <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                {marketingCopy.subhead}
              </p>
              <div className="mt-4 flex items-center gap-3">
                <form
                  action={async () => {
                    "use server";
                    await signIn("google", { redirectTo: "/", prompt: "select_account" });
                  }}
                >
                  <button className="inline-flex items-center justify-center rounded-md bg-indigo-600 text-white px-4 py-2.5 text-sm font-medium hover:bg-indigo-700 transition">
                    {marketingCopy.ctas.primary}
                  </button>
                </form>
                <a href={marketingCopy.links.methodology} className="text-sm text-indigo-700 hover:underline">
                  {marketingCopy.ctas.secondary}
                </a>
              </div>
              <p className="mt-3 text-xs text-gray-600 dark:text-gray-400">
                {marketingCopy.usageNote}
              </p>
              <ul className="mt-4 grid gap-2 text-xs text-gray-700 dark:text-gray-300">
                {marketingCopy.trustBullets.map((item, idx) => (
                  <li key={idx} className="flex gap-2">
                    <span className="mt-[3px] inline-block h-2 w-2 rounded-full bg-indigo-500" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 text-xs text-gray-600 dark:text-gray-400">
                <p>{marketingCopy.scopeStatement}</p>
                <p className="mt-1">{marketingCopy.exclusions}</p>
              </div>
            </section>
          </main>
          <footer className="w-full text-center text-xs text-gray-600 dark:text-gray-400 py-6">
            <p>
              Data from Yahoo Finance via RapidAPI. {marketingCopy.legalDisclaimer}
            </p>
            <p className="mt-2">
              <a className="hover:underline" href={marketingCopy.links.terms}>Terms</a> · {" "}
              <a className="hover:underline" href={marketingCopy.links.privacy}>Privacy</a>
            </p>
          </footer>
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
