import type { Metadata } from "next";
import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { formatPence } from "@/lib/money";
import { connectConfigured } from "@/lib/stripe/client";
import { depositStatus } from "@/lib/stripe/deposit-status";
import { EMPTY_SERVICE, ServiceForm } from "./service-form";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Services" };

export default async function ServicesPage() {
  const { supabase, business } = await requireOwner();
  const t = await getT();
  const { data: services } = await supabase
    .from("services")
    .select("id, name, duration_minutes, price_pence, deposit_pence, active")
    .eq("business_id", business.id)
    .order("active", { ascending: false })
    .order("name");

  const { data: biz } = await supabase.from("businesses").select("stripe_account_id, stripe_charges_enabled").eq("id", business.id).single();
  const deposits = depositStatus({ siteConfigured: connectConfigured(), stripeAccountId: biz?.stripe_account_id ?? null, chargesEnabled: biz?.stripe_charges_enabled === true });

  return (
    <main className="space-y-10">
      <section aria-labelledby="services-h">
        <h1 id="services-h" className="mb-4 text-2xl font-semibold">{t("Services")}</h1>
        {services?.length ? (
          <ul className="divide-y divide-neutral-300 rounded-md border border-neutral-300 dark:divide-neutral-700 dark:border-neutral-700">
            {services.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-4 p-3">
                <div>
                  <p className="font-medium">{s.name}{!s.active && <span className="ml-2 text-sm text-neutral-600 dark:text-neutral-400">({t("hidden")})</span>}</p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    {t("{n} min", { n: s.duration_minutes })} · {formatPence(s.price_pence)}
                    {s.deposit_pence > 0 && ` · ${t("{amount} deposit", { amount: formatPence(s.deposit_pence) })}`}
                  </p>
                  {s.deposit_pence > 0 && deposits !== "ready" && (
                    <p className="text-sm text-amber-800 dark:text-amber-400">{t("Can't be booked online until Stripe is connected and ready.")} <Link href="/dashboard/payments" className="underline">{t("Open Payments")}</Link></p>
                  )}
                </div>
                <Link href={`/dashboard/services/${s.id}`} className="text-sm underline">{t("Edit")}<span className="sr-only"> {s.name}</span></Link>
              </li>
            ))}
          </ul>
        ) : (
          <p>{t("You haven't added any services yet.")}</p>
        )}
      </section>
      <section aria-labelledby="add-h">
        <h2 id="add-h" className="mb-4 text-xl font-semibold">{t("Add a service")}</h2>
        <ServiceForm defaults={EMPTY_SERVICE} deposits={deposits} />
      </section>
    </main>
  );
}
