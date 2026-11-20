import type { Metadata } from "next";
import Link from "next/link";
import { ForgotForm } from "./form";
import { Shell } from "@/components/ui";

export const metadata: Metadata = { title: "Reset your password" };

export default async function ForgotPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <Shell title="Reset your password">
      <p className="mb-4 text-sm">Enter the email you signed up with and we&apos;ll send you a link to choose a new password.</p>
      <ForgotForm expired={error === "expired"} />
      <p className="mt-6 text-sm"><Link className="underline" href="/login">Back to log in</Link></p>
    </Shell>
  );
}
