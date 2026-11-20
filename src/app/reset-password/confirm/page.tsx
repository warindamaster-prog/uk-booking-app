import type { Metadata } from "next";
import Link from "next/link";
import { confirmReset } from "./actions";
import { Shell } from "@/components/ui";
import { TOKEN_HASH_RE } from "@/lib/auth-email";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default async function ConfirmPage({ searchParams }: { searchParams: Promise<{ token_hash?: string }> }) {
  const { token_hash: tokenHash } = await searchParams;
  if (!tokenHash || !TOKEN_HASH_RE.test(tokenHash)) {
    return (
      <Shell title="Reset your password">
        <p className="text-sm">This link isn&apos;t valid. <Link className="underline" href="/forgot-password">Request a new one</Link>.</p>
      </Shell>
    );
  }
  return (
    <Shell title="Reset your password">
      <p className="mb-4 text-sm">Press the button to carry on and choose a new password.</p>
      <form action={confirmReset}>
        <input type="hidden" name="token_hash" value={tokenHash} />
        <button type="submit" className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-neutral-900 px-4 py-2 font-medium text-white dark:bg-white dark:text-neutral-900">
          Continue
        </button>
      </form>
    </Shell>
  );
}
