import type { Metadata } from "next";
import Link from "next/link";
import { confirmReset } from "./actions";
import { Shell } from "@/components/ui";
import { TOKEN_HASH_RE } from "@/lib/auth-email";
import { getT } from "@/lib/i18n/server";
import { rich } from "@/lib/i18n/rich";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default async function ConfirmPage({ searchParams }: { searchParams: Promise<{ token_hash?: string }> }) {
  const { token_hash: tokenHash } = await searchParams;
  const t = await getT();
  if (!tokenHash || !TOKEN_HASH_RE.test(tokenHash)) {
    return (
      <Shell title="Reset your password">
        <p className="text-sm">{rich(t, "This link isn't valid. {again}.", { again: <Link className="underline" href="/forgot-password">{t("Request a new one")}</Link> })}</p>
      </Shell>
    );
  }
  return (
    <Shell title="Reset your password">
      <p className="mb-4 text-sm">{t("Press the button to carry on and choose a new password.")}</p>
      <form action={confirmReset}>
        <input type="hidden" name="token_hash" value={tokenHash} />
        <button type="submit" className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-neutral-900 px-4 py-2 font-medium text-white dark:bg-white dark:text-neutral-900">
          {t("Continue")}
        </button>
      </form>
    </Shell>
  );
}
