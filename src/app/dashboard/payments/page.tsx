import type { Metadata } from "next";
import { requireOwner } from "@/lib/auth";
import { connectConfigured } from "@/lib/stripe/client";
import { connectStripe, disconnectStripe } from "./actions";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Payments" };

const MESSAGES: Record<string, string> = {
  declined: "The connection was cancelled, so nothing changed.",
  invalid: "That connection link was not valid or has expired. Please try again.",
  failed: "We couldn't finish connecting to Stripe. Please try again.",
  in_use: "That Stripe account is already connected to another business here.",
  not_configured: "Card payments aren't switched on for this site yet.",
};

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ connected?: string; disconnected?: string; error?: string }> }) {
  const { supabase, business } = await requireOwner();
  const t = await getT();
  const sp = await searchParams;
  const { data: b } = await supabase.from("businesses").select("stripe_account_id, stripe_charges_enabled").eq("id", business.id).single();
  const connected = !!b?.stripe_account_id;
  const enabled = connected && b?.stripe_charges_enabled === true;
  const configured = connectConfigured();
  const btn = "inline-flex min-h-11 items-center rounded-md border border-neutral-400 px-4 py-2 text-sm";

  return (
    <main className="space-y-8">
      <h1 className="text-2xl font-semibold">{t("Payments")}</h1>
      <p>
        {t("Deposits are paid by card to")} <strong>{t("your own Stripe account")}</strong>{t(", straight from your customer. We take no commission and never hold your money. Stripe charges its normal card fees to your account.")}
      </p>
      {sp.connected && <p role="status" className="rounded-md border border-green-700 p-3 text-sm text-green-800 dark:text-green-400">{t("Stripe connected.")}</p>}
      {sp.disconnected && <p role="status" className="rounded-md border border-neutral-400 p-3 text-sm">{t("Stripe disconnected. Services with a deposit can't be booked online until you connect again.")}</p>}
      {sp.error && <p role="alert" className="rounded-md border border-red-700 p-3 text-sm text-red-700 dark:text-red-400">{t(MESSAGES[sp.error] ?? MESSAGES.failed)}</p>}

      <section aria-labelledby="status-h" className="space-y-3">
        <h2 id="status-h" className="text-xl font-semibold">{t("Stripe account")}</h2>
        {enabled ? (
          <>
            <p>{t("Connected and able to take card payments.")}</p>
            <form action={disconnectStripe}><button type="submit" className={btn}>{t("Disconnect Stripe")}</button></form>
          </>
        ) : connected ? (
          <>
            <p>{t("Connected, but Stripe still needs some details from you before it can take payments. Finish setting up in your Stripe dashboard; this page updates by itself.")}</p>
            <form action={disconnectStripe}><button type="submit" className={btn}>{t("Disconnect Stripe")}</button></form>
          </>
        ) : (
          <>
            <p>{t("Not connected. Until you connect, services with a deposit can't be booked online.")}</p>
            {configured
              ? <form action={connectStripe}><button type="submit" className={btn}>{t("Connect with Stripe")}</button></form>
              : <p className="text-sm">{t("Card payments aren't switched on for this site yet.")}</p>}
          </>
        )}
      </section>
    </main>
  );
}
