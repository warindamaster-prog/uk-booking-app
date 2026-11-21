import type { Metadata } from "next";
import Link from "next/link";
import { ForgotForm } from "./form";
import { Shell } from "@/components/ui";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Reset your password" };

export default async function ForgotPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const t = await getT();
  return (
    <Shell title="Reset your password">
      <p className="mb-4 text-sm">{t("Enter the email you signed up with and we'll send you a link to choose a new password.")}</p>
      <ForgotForm expired={error === "expired"} />
      <p className="mt-6 text-sm"><Link className="underline" href="/login">{t("Back to log in")}</Link></p>
    </Shell>
  );
}
