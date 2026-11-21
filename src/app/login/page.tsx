import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./form";
import { Shell } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { rich } from "@/lib/i18n/rich";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage() {
  const t = await getT();
  return (
    <Shell title="Log in">
      <LoginForm />
      <p className="mt-4 text-sm"><Link className="underline" href="/forgot-password">{t("Forgot your password?")}</Link></p>
      <p className="mt-4 text-sm">
        {rich(t, "New here? {signup}", { signup: <Link className="underline" href="/signup">{t("Create an account")}</Link> })}
      </p>
    </Shell>
  );
}
