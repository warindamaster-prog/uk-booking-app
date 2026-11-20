import type { Metadata } from "next";
import Link from "next/link";
import { confirmSignup } from "./actions";
import { Shell } from "@/components/ui";
import { TOKEN_HASH_RE } from "@/lib/auth-email";

export const metadata: Metadata = { title: "Confirm your email", robots: { index: false } };

export default async function ConfirmSignupPage({ searchParams }: { searchParams: Promise<{ token_hash?: string }> }) {
  const { token_hash: tokenHash } = await searchParams;
  if (!tokenHash || !TOKEN_HASH_RE.test(tokenHash)) {
    return (
      <Shell title="Confirm your email">
        <p className="text-sm">This link isn&apos;t valid. <Link className="underline" href="/login">Log in</Link> or <Link className="underline" href="/signup">sign up again</Link>.</p>
      </Shell>
    );
  }
  return (
    <Shell title="Confirm your email">
      <p className="mb-4 text-sm">Press the button to confirm your email and set up your business.</p>
      <form action={confirmSignup}>
        <input type="hidden" name="token_hash" value={tokenHash} />
        <button type="submit" className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-neutral-900 px-4 py-2 font-medium text-white dark:bg-white dark:text-neutral-900">
          Confirm my email
        </button>
      </form>
    </Shell>
  );
}
