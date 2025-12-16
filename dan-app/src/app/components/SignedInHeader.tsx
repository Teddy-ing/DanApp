import Link from "next/link";
import ExportButton from "@/app/components/ExportButton";
import KeyModal from "@/app/components/KeyModal";

type Props = {
  userLabel: string;
  sharedKeyActive: boolean;
  activePath: "/returns" | "/yieldmax";
};

export default function SignedInHeader({ userLabel, sharedKeyActive, activePath }: Props) {
  const navLinkBase =
    "inline-flex items-center justify-center rounded-md border border-black/10 dark:border-white/15 px-3 py-1.5 text-sm font-medium transition hover:bg-white dark:hover:bg-neutral-900";

  return (
    <header className="row-start-1 w-full flex items-center justify-between">
      <div className="text-sm text-gray-600 dark:text-gray-300">
        <span>Signed in as {userLabel}</span>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <Link
          href="/returns"
          className={`${navLinkBase} ${activePath === "/returns" ? "bg-white dark:bg-neutral-900 shadow-sm" : ""}`}
        >
          Returns
        </Link>
        <Link
          href="/yieldmax"
          className={`${navLinkBase} ${activePath === "/yieldmax" ? "bg-white dark:bg-neutral-900 shadow-sm" : ""}`}
        >
          YieldMax
        </Link>
        <ExportButton />
        <KeyModal sharedKeyActive={sharedKeyActive} />
        <Link className="underline" href="/api/auth/signout">
          Sign out
        </Link>
      </div>
    </header>
  );
}

