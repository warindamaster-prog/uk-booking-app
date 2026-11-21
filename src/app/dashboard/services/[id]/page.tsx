import { BackLink } from "@/components/back-link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { penceToInput } from "@/lib/money";
import { connectConfigured } from "@/lib/stripe/client";
import { depositStatus } from "@/lib/stripe/deposit-status";
import { uuid } from "@/lib/validation/catalog";
import { LevelPricesForm } from "../level-prices-form";
import { ServiceForm } from "../service-form";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Edit service" };

export default async function EditServicePage({ params }: { params: Promise<{ id: string }> }) {
  const id = uuid.safeParse((await params).id);
  if (!id.success) notFound();
  const { supabase, business } = await requireOwner();
  const t = await getT();
  const { data: s } = await supabase.from("services").select("*").eq("id", id.data).eq("business_id", business.id).maybeSingle();
  if (!s) notFound();

  const [{ data: levels }, { data: levelPrices }] = await Promise.all([
    supabase.from("staff_levels").select("id, name").eq("business_id", business.id).order("sort_order").order("name"),
    supabase.from("service_level_prices").select("level_id, price_pence").eq("service_id", s.id),
  ]);
  const { data: biz } = await supabase.from("businesses").select("stripe_account_id, stripe_charges_enabled").eq("id", business.id).single();
  const deposits = depositStatus({ siteConfigured: connectConfigured(), stripeAccountId: biz?.stripe_account_id ?? null, chargesEnabled: biz?.stripe_charges_enabled === true });
  const priceOf = new Map((levelPrices ?? []).map((p) => [p.level_id, p.price_pence]));

  return (
    <main className="space-y-6">
      <BackLink href="/dashboard/services" label={t("← All services")} />
      <h1 className="text-2xl font-semibold">{t("Edit service")}</h1>
      <ServiceForm defaults={{
        id: s.id, name: s.name, description: s.description ?? "", duration: String(s.duration_minutes),
        bufferBefore: String(s.buffer_before_minutes), bufferAfter: String(s.buffer_after_minutes),
        price: penceToInput(s.price_pence), deposit: s.deposit_pence ? penceToInput(s.deposit_pence) : "", active: s.active,
      }} deposits={deposits} />

      {levels && levels.length > 0 && (
        <section aria-labelledby="levels-h" className="space-y-4">
          <h2 id="levels-h" className="text-xl font-semibold">{t("Prices by team level")}</h2>
          <LevelPricesForm serviceId={s.id} standardPrice={penceToInput(s.price_pence)}
            levels={levels.map((l) => ({ id: l.id, name: l.name, price: priceOf.has(l.id) ? penceToInput(priceOf.get(l.id)!) : "" }))} />
        </section>
      )}
    </main>
  );
}
