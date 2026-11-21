import type { Metadata } from "next";
import { requireOwner } from "@/lib/auth";
import { SettingsForm } from "./settings-form";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { supabase, business } = await requireOwner();
  const t = await getT();
  const { data: b } = await supabase.from("businesses")
    .select("owner_name, email, phone, cancellation_window_hours, privacy_notice_url, show_contact_to_customers, confirmation_message, deposit_policy, deposit_refundable").eq("id", business.id).single();
  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-semibold">{t("Settings")}</h1>
      <SettingsForm shopName={business.name} defaults={{
        ownerName: b?.owner_name ?? "", email: b?.email ?? "", phone: b?.phone ?? "",
        cancellationHours: b?.cancellation_window_hours ?? 24, privacyUrl: b?.privacy_notice_url ?? "", showContact: b?.show_contact_to_customers ?? true,
        confirmationMessage: b?.confirmation_message ?? "",
        depositPolicy: b?.deposit_policy ?? "", depositRefundable: b?.deposit_refundable !== false,
      }} />
    </main>
  );
}
