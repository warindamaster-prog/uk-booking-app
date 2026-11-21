import type { Metadata } from "next";
import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { rich } from "@/lib/i18n/rich";
import { SupportForm } from "./support-form";

export const metadata: Metadata = { title: "Support" };

export default async function SupportPage() {
  const { user } = await requireBusiness();
  const t = await getT();
  const link = (href: string, label: string) => <Link className="underline" href={href}>{t(label)}</Link>;
  const FAQ: [string, React.ReactNode][] = [
    ["Customers see \"Online booking isn't available right now\"", rich(t, "Your booking page is closed until your subscription is active. Open {billing} to subscribe or to check your card.", { billing: link("/dashboard/billing", "Billing") })],
    ["A customer didn't get their confirmation email", t("Ask them to check their junk folder first, and check the email address on the booking is spelled correctly. If it still hasn't arrived, send us a message below with the customer's name and the booking time and we'll look into it.")],
    ["How do I take deposits?", rich(t, "Open {payments}, connect your Stripe account, then set a deposit on each service.", { payments: link("/dashboard/payments", "Payments") })],
    ["How do I add or remove people?", rich(t, "Go to {staff}. Adding a person is charged straight away for the rest of your billing period; removing one lowers your price from your next renewal. See {billing}.", { staff: link("/dashboard/staff", "Staff"), billing: link("/dashboard/billing", "Billing") })],
    ["I forgot my password", rich(t, "Use {reset} on the log-in page.", { reset: link("/forgot-password", "Reset your password") })],
  ];
  return (
    <main className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">{t("Support")}</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{t("Stuck, or something not working? Send us a message and we'll reply by email, usually within one working day.")}</p>
      </div>
      <section aria-labelledby="faq" className="space-y-3">
        <h2 id="faq" className="text-lg font-semibold">{t("Quick answers")}</h2>
        {FAQ.map(([q, a]) => (
          <details key={q} className="rounded-md border border-neutral-300 p-3 text-sm dark:border-neutral-700">
            <summary className="cursor-pointer font-medium">{t(q)}</summary>
            <p className="mt-2">{a}</p>
          </details>
        ))}
      </section>
      <section aria-labelledby="contact" className="space-y-3">
        <h2 id="contact" className="text-lg font-semibold">{t("Message our team")}</h2>
        <SupportForm defaultEmail={user.email ?? ""} />
      </section>
    </main>
  );
}
