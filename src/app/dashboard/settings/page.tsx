import type { Metadata } from "next";
import { requireOwner } from "@/lib/auth";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { supabase, business } = await requireOwner();
  const { data: b } = await supabase.from("businesses")
    .select("owner_name, email, phone, cancellation_window_hours, privacy_notice_url, show_contact_to_customers").eq("id", business.id).single();
  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <SettingsForm defaults={{
        ownerName: b?.owner_name ?? "", email: b?.email ?? "", phone: b?.phone ?? "",
        cancellationHours: b?.cancellation_window_hours ?? 24, privacyUrl: b?.privacy_notice_url ?? "", showContact: b?.show_contact_to_customers ?? true,
      }} />
    </main>
  );
}
