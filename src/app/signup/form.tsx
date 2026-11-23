"use client";

import { useActionState } from "react";
import { signup } from "./actions";
import { Field, FormError, SubmitButton } from "@/components/ui";
import type { FormState } from "@/lib/form";
import Link from "next/link";
import { useT } from "@/lib/i18n/client";

export function SignupForm() {
  const t = useT();
  const [state, action, pending] = useActionState<FormState, FormData>(signup, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormError message={state.error} />
      <Field label="Email" name="email" type="email" autoComplete="email" required
        defaultValue={state.values?.email} errors={state.fieldErrors?.email} />
      <Field label="Password" name="password" type="password" autoComplete="new-password" required
        hint="At least 10 characters." errors={state.fieldErrors?.password} />
      <p className="text-sm text-[color:var(--brand-muted,#6b756d)]">
        {t("By creating an account you agree to our")} <Link href="/terms" className="underline">{t("Terms of Service")}</Link> {t("and")} <Link href="/privacy" className="underline">{t("Privacy notice")}</Link>.
      </p>
      <SubmitButton pending={pending}>Create account</SubmitButton>
    </form>
  );
}
