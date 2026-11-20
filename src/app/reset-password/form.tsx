"use client";

import { useActionState } from "react";
import { setNewPassword } from "./actions";
import { Field, FormError, SubmitButton } from "@/components/ui";
import type { FormState } from "@/lib/form";

export function ResetForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(setNewPassword, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormError message={state.error} />
      <Field label="New password" name="password" type="password" autoComplete="new-password" required
        hint="At least 10 characters." errors={state.fieldErrors?.password} />
      <Field label="Repeat the new password" name="confirm" type="password" autoComplete="new-password" required
        errors={state.fieldErrors?.confirm} />
      <SubmitButton pending={pending}>Save new password</SubmitButton>
    </form>
  );
}
