"use client";

import Link from "next/link";
import { useActionState } from "react";
import { setNewPassword } from "./actions";
import { Field, FormError, SubmitButton } from "@/components/ui";
import type { FormState } from "@/lib/form";
import { useT } from "@/lib/i18n/client";

export function ResetForm() {
  const t = useT();
  const [state, action, pending] = useActionState<FormState, FormData>(setNewPassword, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormError message={state.error} />
      {state.message && (
        <p role="status" className="rounded-md border border-green-700 p-3 text-sm text-green-800 dark:text-green-400">
          {t(state.message)}{" "}
          {state.values?.loggedIn && <Link className="underline" href="/dashboard">{t("Go to the dashboard")}</Link>}
        </p>
      )}
      <Field label="New password" name="password" type="password" autoComplete="new-password" required
        hint="At least 10 characters." errors={state.fieldErrors?.password} />
      <Field label="Repeat the new password" name="confirm" type="password" autoComplete="new-password" required
        errors={state.fieldErrors?.confirm} />
      <SubmitButton pending={pending}>Save new password</SubmitButton>
    </form>
  );
}
