import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getSharedRapidApiKey } from "@/lib/userKey";
import SignedInHeader from "@/app/components/SignedInHeader";
import YieldmaxTables from "@/app/components/YieldmaxTables";

export default async function YieldmaxPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/");
  }
  const sharedKeyActive = Boolean(getSharedRapidApiKey());

  return (
    <div className="font-sans grid grid-rows-[auto_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-6 sm:p-20">
      <SignedInHeader
        userLabel={session.user.email || session.user.name || ""}
        sharedKeyActive={sharedKeyActive}
        activePath="/yieldmax"
      />
      <main id="main-content" className="row-start-2 w-full max-w-7xl">
        <h1 className="text-2xl font-semibold mb-3">YieldMax ETFs</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          Rates use Yahoo Finance (dividends over last 12 months ÷ latest price). ROC is scraped from YieldMax.
        </p>
        <YieldmaxTables />
      </main>
      <footer className="row-start-3 w-full text-center text-xs text-gray-600 dark:text-gray-400 py-4">
        <p>
          Data provided by Yahoo Finance via RapidAPI and YieldMax. For informational purposes only. Not investment advice.
        </p>
      </footer>
    </div>
  );
}

