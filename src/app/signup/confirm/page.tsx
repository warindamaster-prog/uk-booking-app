import type { Metadata } from "next";
import Link from "next/link";
import { confirmSignup } from "./actions";
import { Shell } from "@/components/ui";
import { TOKEN_HASH_RE } from "@/lib/auth-email";
import { getT } from "@/lib/i18n/server";
import { rich } from "@/lib/i18n/rich";

export const metadata: Metadata = { title: "Confirm your email", robots: { index: false } };

export default async function ConfirmSignupPage({ searchParams }: { searchParams: Promise<{ token_hash?: string }> }) {
  const { token_hash: tokenHash } = await searchParams;
  const t = await getT();
  if (!tokenHash || !TOKEN_HASH_RE.test(tokenHash)) {
    return (
      <Shell title="Confirm your email">
        <p className="text-sm">{rich(t, "This link isn't valid. {login} or {signup}.", { login: <Link className="underline" href="/login">{t("Log in")}</Link>, signup: <Link className="underline" href="/signup">{t("sign up again")}</Link> })}</p>
      </Shell>
    );
  }
  return (
    <Shell title="Confirm your email">
      <p className="mb-4 text-sm">{t("Press the button to confirm your email and set up your business.")}</p>
      <form action={confirmSignup}>
        <input type="hidden" name="token_hash" value={tokenHash} />
        <button type="submit" className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-neutral-900 px-4 py-2 font-medium text-white dark:bg-white dark:text-neutral-900">
          {t("Confirm my email")}
        </button>
      </form>
    </Shell>
  );
}
