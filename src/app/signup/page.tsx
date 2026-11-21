import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "./form";
import { Shell } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { rich } from "@/lib/i18n/rich";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignupPage() {
  const t = await getT();
  return (
    <Shell title="Create your account">
      <SignupForm />
      <p className="mt-6 text-sm">
        {rich(t, "Already registered? {login}", { login: <Link className="underline" href="/login">{t("Log in")}</Link> })}
      </p>
    </Shell>
  );
}
