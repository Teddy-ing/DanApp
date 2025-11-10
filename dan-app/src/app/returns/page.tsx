import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import ExportButton from "@/app/components/ExportButton";
import KeyModal from "@/app/components/KeyModal";
import ReturnsShell from "@/app/components/ReturnsShell";
import { getSharedRapidApiKey } from "@/lib/userKey";
import { getSharedView } from "@/lib/savedViews";

type ReturnsPageProps = {
  searchParams?: {
    share?: string;
  };
};

export default async function ReturnsPage(props: ReturnsPageProps) {
  const shareId = typeof props.searchParams?.share === "string" && props.searchParams.share.length > 0 ? props.searchParams.share : null;
  const session = await auth();
  if (!session?.user) {
    if (shareId) {
      redirect(`/login?share=${shareId}`);
    }
    redirect("/");
  }
  const sharedKeyActive = Boolean(getSharedRapidApiKey());
  const sharedConfig = shareId ? await getSharedView(shareId) : null;
  const initialConfig = sharedConfig
    ? {
        symbols: sharedConfig.symbols,
        base: sharedConfig.base,
        horizon: sharedConfig.horizon,
        custom: sharedConfig.custom,
        viewMode: sharedConfig.viewMode,
      }
    : undefined;

  return (
    <div className="font-sans grid grid-rows-[auto_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-6 sm:p-20">
      <header className="row-start-1 w-full flex items-center justify-between">
        <div className="text-sm text-gray-600 dark:text-gray-300">
          <span>Signed in as {session.user.email || session.user.name}</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <ExportButton />
          <KeyModal sharedKeyActive={sharedKeyActive} />
          <Link className="underline" href="/api/auth/signout">Sign out</Link>
        </div>
      </header>
      <main id="main-content" className="row-start-2 w-full">
        <ReturnsShell initialConfig={initialConfig} initialShareId={shareId ?? undefined} />
      </main>
      <footer className="row-start-3 w-full text-center text-xs text-gray-600 dark:text-gray-400 py-4">
        <p>
          Data provided by Yahoo Finance via RapidAPI. For informational purposes only. Not investment advice.
        </p>
      </footer>
    </div>
  );
}


