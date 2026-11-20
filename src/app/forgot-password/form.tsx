"use client";

import { useActionState } from "react";
import { requestReset } from "./actions";
import { Field, FormError, SubmitButton } from "@/components/ui";
import type { FormState } from "@/lib/form";

export function ForgotForm({ expired }: { expired: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(requestReset, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      {expired && !state.message && <p role="alert" className="rounded-md border border-amber-700 p-3 text-sm">That link has expired or was already used. Enter your email to get a new one. Open the new link in the same browser you used here.</p>}
      <FormError message={state.error} />
      {state.message && <p role="status" className="rounded-md border border-green-700 p-3 text-sm text-green-800 dark:text-green-400">{state.message}</p>}
      <Field label="Email" name="email" type="email" autoComplete="email" required
        defaultValue={state.values?.email} errors={state.fieldErrors?.email} />
      <SubmitButton pending={pending}>Send me a link</SubmitButton>
    </form>
  );
}
