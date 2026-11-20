import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ResetForm } from "./form";
import { Shell } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/forgot-password?error=expired"); // no session: the link wasn't opened, or it expired
  return (
    <Shell title="Choose a new password">
      <ResetForm />
    </Shell>
  );
}
