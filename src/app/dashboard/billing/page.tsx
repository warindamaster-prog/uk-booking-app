import type { Metadata } from "next";
import { requireOwner } from "@/lib/auth";
import { billingEnabled, bookingsOpen, daysLeftLabel, noTrialMode, trialDaysLeft } from "@/lib/billing";
import { smsPacksEnabled } from "@/lib/sms-switch";
import { billingStripeReady, prepaidStripeReady } from "@/lib/stripe/billing-service";
import { threeYearEnabled } from "@/lib/three-year-switch";
import { formatPence } from "@/lib/money";
import { grossPence, vatPence } from "@/lib/pricing";
import { formatDate } from "@/lib/time";
import { intlLocale } from "@/lib/i18n/core";
import { getLocale, getT } from "@/lib/i18n/server";
import { manageBilling, payPrepaid, subscribe } from "./actions";
import { CancelReductionForm } from "./cancel-form";
import { SeatsForm } from "./seats-form";
import { SmsForm } from "./sms-form";

export const metadata: Metadata = { title: "Billing" };

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ subscribed?: string; paid?: string; error?: string; welcome?: string }> }) {
  const sp = await searchParams;
  const { supabase, business } = await requireOwner();
  const t = await getT();
  const loc = intlLocale(await getLocale());
  const fd = (d: string | Date) => formatDate(d, undefined, loc);
  const { data: b } = await supabase.from("business_billing").select("*").eq("business_id", business.id).maybeSingle();
  const { count } = await supabase.from("staff").select("id", { count: "exact", head: true }).eq("business_id", business.id).eq("active", true);
  if (!b) return <main><p>{t("We couldn't find your billing details. Please contact support.")}</p></main>;

  const three = b.billing_interval === "three_year" && threeYearEnabled();
  const per = (three ? "month" : b.billing_interval) as "month" | "year"; // only used for the subscription plans
  const line = (pence: number) => t("{net} + {vat} VAT = {gross}", { net: formatPence(pence), vat: formatPence(vatPence(pence)), gross: formatPence(grossPence(pence)) });
  const row = "flex justify-between gap-4 py-2";
  const termEnds = b.current_period_end ? fd(b.current_period_end) : null;

  return (
    <main className="space-y-8">
      <h1 className="text-2xl font-semibold">{t("Billing")}</h1>

      {sp.welcome && (
        <p role="status" className="rounded-md border border-green-700 p-3 text-sm text-green-800 dark:text-green-400">
          {t("Welcome! Your business is set up.")} {noTrialMode() ? t("There is no free trial: subscribe below to open your booking page to customers. Until then you can set everything up here.") : ""}
        </p>
      )}
      {billingEnabled() && !bookingsOpen(b, { now: new Date(), billingEnabled: true }) && (
        <p role="alert" className="rounded-md border border-amber-700 p-3 text-sm">
          {t("Your booking page is closed. Customers see \"Online booking isn't available right now\" until your subscription is active.")}
        </p>
      )}
      {b.status === "trialing" && bookingsOpen(b, { now: new Date(), billingEnabled: billingEnabled() }) && (
        <p role="status" className="rounded-md bg-neutral-100 p-3 text-sm dark:bg-neutral-800">
          {t("You're on a free trial: {left} (until {date}).", { left: daysLeftLabel(trialDaysLeft(b.trial_ends_at), t), date: fd(b.trial_ends_at) })}{" "}
          {three
            ? t("To keep your booking page open after the trial, pay for your 3-year plan below. Nothing is charged automatically.")
            : b.stripe_subscription_id
            ? t("Your card is saved: the first payment is taken when the trial ends, not before.")
            : t("No card is needed for the trial. If you add a card, nothing is charged until the trial ends; after that your subscription starts.")}
        </p>
      )}

      {sp.paid && !(three && b.status === "active") && <p role="status" className="rounded-md border border-green-700 p-3 text-sm text-green-800 dark:text-green-400">{t("Thank you. We're confirming your payment and your 3-year plan will start in a moment. Refresh this page in a minute.")}</p>}
      {sp.subscribed && <p role="status" className="rounded-md border border-green-700 p-3 text-sm text-green-800 dark:text-green-400">{t("Thank you. Your subscription is being set up and this page will update in a moment.")}</p>}
      {sp.error && <p role="alert" className="rounded-md border border-red-700 p-3 text-sm text-red-700 dark:text-red-400">
        {sp.error === "unavailable" ? t("Card payments aren't set up on this site yet.") : t("Something went wrong. Please try again.")}</p>}

      {billingEnabled() && three && (
        <section aria-labelledby="sub-h" className="space-y-3">
          <h2 id="sub-h" className="text-xl font-semibold">{t("3-year prepaid plan")}</h2>
          {b.status === "active" ? (
            <>
              <p>{t("Paid on {date}. Your plan runs until {end}. It does not renew by itself: we'll email you 60 and 30 days before it ends.", { date: b.prepaid_paid_at ? fd(b.prepaid_paid_at) : "", end: termEnds ?? "" })}</p>
              <p className="text-sm">{t("Your invoice was emailed to you by Stripe. Full refund within 14 days of payment: contact support.")}</p>
            </>
          ) : (
            <>
              <p>{t("Pay once for 3 years: {total}. The price is fixed for the whole term and nothing is charged automatically.", { total: line(b.current_price_pence) })}</p>
              <p className="text-sm">{t("Full refund within 14 days of payment: contact support.")}</p>
              {prepaidStripeReady()
                ? <form action={payPrepaid}><button type="submit" className="inline-flex min-h-11 items-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">{t("Pay {amount} for 3 years", { amount: formatPence(grossPence(b.current_price_pence)) })}</button></form>
                : <p className="text-sm">{t("Card payments aren't set up on this site yet.")}</p>}
            </>
          )}
        </section>
      )}

      {billingEnabled() && !three && (
        <section aria-labelledby="sub-h" className="space-y-3">
          <h2 id="sub-h" className="text-xl font-semibold">{t("Subscription")}</h2>
          {b.stripe_subscription_id ? (
            <>
              <p>{t("Status: {status}.", { status: b.status === "trialing" ? t("free trial (your card is saved; nothing is charged until the trial ends)") : t(b.status.replace("_", " ")) })}
                {b.current_period_end && ` ${t("Next renewal: {date}.", { date: fd(b.current_period_end) })}`}</p>
              <form action={manageBilling}><button type="submit" className="inline-flex min-h-11 items-center rounded-md border border-neutral-400 px-4 py-2 text-sm">{t("Manage card, invoices and cancellation")}</button></form>
            </>
          ) : (
            <>
              <p>{noTrialMode()
                ? t("Subscribe to open your booking page to customers. The first payment is taken straight away (test mode).")
                : new Date(b.trial_ends_at) > new Date()
                ? (process.env.BILLING_SKIP_TRIAL === "true"
                  ? t("Test mode: subscribing takes the first payment straight away instead of waiting for the free trial to end.")
                  : t("Add a card to keep your booking page open after your free trial ends on {date}. Nothing is charged until then.", { date: fd(b.trial_ends_at) }))
                : t("Your free trial has ended. Add a card to open your booking page again.")}</p>
              {billingStripeReady()
                ? <form action={subscribe}><button type="submit" className="inline-flex min-h-11 items-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">{t("Add a card and subscribe")}</button></form>
                : <p className="text-sm">{t("Card payments aren't set up on this site yet.")}</p>}
            </>
          )}
        </section>
      )}

      <section aria-labelledby="plan-h">
        <h2 id="plan-h" className="mb-2 text-xl font-semibold">{t("Your plan")}</h2>
        <dl className="divide-y divide-neutral-300 rounded-md border border-neutral-300 px-3 dark:divide-neutral-700 dark:border-neutral-700">
          <div className={row}><dt>{t("Team members paid for")}</dt><dd>{t("{paid} ({used} in use)", { paid: b.staff_seats, used: count ?? 0 })}</dd></div>
          {(smsPacksEnabled() || b.sms_packs > 0) && <div className={row}><dt>SMS packs</dt><dd>{b.sms_packs === 0 ? "None" : `${b.sms_packs} (${b.sms_packs * 50} texts a month, ${b.sms_enabled ? "on" : "off"})`}</dd></div>}
          <div className={row}><dt>{t("Billing")}</dt><dd>{three ? t("3-year prepaid") : t(per === "year" ? "Yearly" : "Monthly")}</dd></div>
          {three ? (
            <>
              <div className={row}><dt>{b.status === "active" ? t("Paid for 3 years") : t("Price for 3 years")}</dt><dd>{line(b.current_price_pence)}</dd></div>
              {b.status === "active" && termEnds && <div className={row}><dt>{t("Plan ends")}</dt><dd>{termEnds}</dd></div>}
            </>
          ) : b.stripe_subscription_id && b.status !== "trialing" ? (
            <>
              <div className={row}><dt>{t(per === "year" ? "Paid this year" : "Paid this month")}</dt><dd>{line(b.paid_this_period_pence)}</dd></div>
              <div className={row}>
                <dt>{b.current_period_end ? t("From your next renewal ({date})", { date: fd(b.current_period_end) }) : t("From your next renewal")}</dt>
                <dd>
                  {b.next_price_pence !== null && b.change_effective_at ? (
                    <>
                      {t("{n} team members", { n: b.next_staff_seats ?? b.staff_seats })}
                      {(b.next_sms_packs ?? b.sms_packs) > 0 && `, ${t((b.next_sms_packs ?? b.sms_packs) === 1 ? "{n} SMS pack" : "{n} SMS packs", { n: b.next_sms_packs ?? b.sms_packs })}`}
                      {`, ${line(b.next_price_pence)}`}
                    </>
                  ) : line(b.current_price_pence)}
                </dd>
              </div>
            </>
          ) : (
            <>
              <div className={row}><dt>{b.status === "trialing" && !noTrialMode() ? t(per === "year" ? "Price after trial (per year)" : "Price after trial (per month)") : t(per === "year" ? "Plan price (per year)" : "Plan price (per month)")}</dt><dd>{line(b.current_price_pence)}</dd></div>
              {b.next_price_pence !== null && b.change_effective_at && (
                <div className={row}>
                  <dt>{t("From {date}", { date: fd(b.change_effective_at) })}</dt>
                  <dd>
                    {t("{n} team members", { n: b.next_staff_seats ?? b.staff_seats })}
                    {(b.next_sms_packs ?? b.sms_packs) > 0 && `, ${t((b.next_sms_packs ?? b.sms_packs) === 1 ? "{n} SMS pack" : "{n} SMS packs", { n: b.next_sms_packs ?? b.sms_packs })}`}
                    {`, ${line(b.next_price_pence)}`}
                  </dd>
                </div>
              )}
            </>
          )}
        </dl>
        {b.next_price_pence !== null && <div className="mt-2"><CancelReductionForm /></div>}
      </section>

      <section aria-labelledby="team-h" className="space-y-3">
        <h2 id="team-h" className="text-xl font-semibold">{t("Change team size")}</h2>
        {three && b.status === "active" ? <p>{t("Your 3-year plan covers the team size you paid for. To change it, please contact support.")}</p> : <SeatsForm noTrial={noTrialMode()} current={b.staff_seats} scheduled={b.next_staff_seats} interval={per} hasSubscription={!!b.stripe_subscription_id}
          periodEnd={b.current_period_end} periodEndLabel={b.current_period_end ? fd(b.current_period_end) : null} />}
      </section>

      {smsPacksEnabled() && !three && (
      <section aria-labelledby="sms-h" className="space-y-3">
        <h2 id="sms-h" className="text-xl font-semibold">SMS confirmations</h2>
        <SmsForm noTrial={noTrialMode()} current={b.sms_packs} scheduled={b.next_sms_packs} enabled={b.sms_enabled} seats={b.next_staff_seats ?? b.staff_seats}
          interval={per} hasSubscription={!!b.stripe_subscription_id}
          periodEnd={b.current_period_end} periodEndLabel={b.current_period_end ? formatDate(b.current_period_end) : null} />
      </section>
      )}
    </main>
  );
}
