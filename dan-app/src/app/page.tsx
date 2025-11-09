import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { marketingCopy } from "@/lib/marketingCopy";

export default async function Home() {
  const session = await auth();
  if (session?.user) {
    redirect("/returns");
  }
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
            <a
              href="/login"
              className="inline-flex items-center justify-center rounded-md bg-indigo-600 text-white px-3 py-2 text-sm font-medium hover:bg-indigo-700 transition"
            >
              {marketingCopy.ctas.primary}
            </a>
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
                <a
                  href="/login"
                  className="inline-flex items-center justify-center rounded-md bg-indigo-600 text-white px-4 py-2.5 text-sm font-medium hover:bg-indigo-700 transition"
                >
                  {marketingCopy.ctas.primary}
                </a>
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
            <section id="methodology" aria-labelledby="methodology-heading" className="mt-10 rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-neutral-900 shadow-sm p-6">
              <h2 id="methodology-heading" className="text-xl font-semibold">Methodology</h2>
              <ul className="list-disc ml-5 mt-3 text-sm text-gray-700 dark:text-gray-300">
                <li>Dividends are reinvested at the next U.S. market open after pay date.</li>
                <li>Corporate actions (splits) are applied before reinvestment calculations.</li>
                <li>ETF payouts are treated as distributions and reinvested the same way.</li>
                <li>Non-dividend tickers show price return (total return equals price return).</li>
              </ul>
            </section>
            <section id="reliability" aria-labelledby="reliability-heading" className="mt-6 rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-neutral-900 shadow-sm p-6">
              <h2 id="reliability-heading" className="text-xl font-semibold">Reliability & Scope</h2>
              <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">Data from Yahoo Finance via RapidAPI with issuer IR fallback when gaps are detected. U.S. trading calendar/timezone.</p>
              <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{marketingCopy.scopeStatement}</p>
              <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{marketingCopy.exclusions}</p>
            </section>
            <section id="security" aria-labelledby="security-heading" className="mt-6 rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-neutral-900 shadow-sm p-6">
              <h2 id="security-heading" className="text-xl font-semibold">Security & Privacy</h2>
              <ul className="list-disc ml-5 mt-3 text-sm text-gray-700 dark:text-gray-300">
                <li>Google sign-in only; no passwords to manage.</li>
                <li>Your RapidAPI key is stored encrypted per user and never sent to the client after save.</li>
                <li>HTTPS everywhere; secure cookies in production.</li>
              </ul>
            </section>
            <section id="faq" aria-labelledby="faq-heading" className="mt-6 rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-neutral-900 shadow-sm p-6">
              <h2 id="faq-heading" className="text-xl font-semibold">FAQ</h2>
              <div className="mt-3 divide-y divide-black/10 dark:divide-white/10">
                <details>
                  <summary className="cursor-pointer py-2 text-sm font-medium">Why Google sign-in only?</summary>
                  <div className="pb-3 text-sm text-gray-700 dark:text-gray-300">It keeps onboarding fast and secure for most users. We may add other providers later based on demand.</div>
                </details>
                <details id="pricing-usage">
                  <summary className="cursor-pointer py-2 text-sm font-medium">Pricing & Usage</summary>
                  <div className="pb-3 text-sm text-gray-700 dark:text-gray-300">{marketingCopy.usageNote}</div>
                </details>
                <details>
                  <summary className="cursor-pointer py-2 text-sm font-medium">Which tickers are supported?</summary>
                  <div className="pb-3 text-sm text-gray-700 dark:text-gray-300">{marketingCopy.scopeStatement} {marketingCopy.exclusions}</div>
                </details>
                <details>
                  <summary className="cursor-pointer py-2 text-sm font-medium">How accurate is DRIP?</summary>
                  <div className="pb-3 text-sm text-gray-700 dark:text-gray-300">We reinvest dividends at the next U.S. market open after pay date and apply splits beforehand. ETF distributions follow the same rule.</div>
                </details>
                <details>
                  <summary className="cursor-pointer py-2 text-sm font-medium">Can I export results?</summary>
                  <div className="pb-3 text-sm text-gray-700 dark:text-gray-300">Yes. XLSX export is included, and additional formats are coming. Exports are available to everyone while billing is deferred.</div>
                </details>
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
