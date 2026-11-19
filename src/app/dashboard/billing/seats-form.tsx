"use client";

import { useActionState, useState } from "react";
import { updateSeats } from "./actions";
import { Field, FormError, SubmitButton } from "@/components/ui";
import type { FormState } from "@/lib/form";
import { formatPence } from "@/lib/money";
import { isValidSeats, pricePence, type BillingInterval } from "@/lib/pricing";

export function SeatsForm({ current, interval, hasSubscription }: { current: number; interval: BillingInterval; hasSubscription: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateSeats, {});
  const [text, setText] = useState(String(current));
  const n = /^\d+$/.test(text) ? Number(text) : NaN;
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormError message={state.error} />
      {state.message && <p role="status" className="rounded-md border border-green-700 p-3 text-sm text-green-800 dark:text-green-400">{state.message}</p>}
      <Field label="People who take bookings" name="seats" inputMode="numeric" required value={text}
        onChange={(e) => setText(e.target.value)} errors={state.fieldErrors?.seats}
        hint={hasSubscription
          ? "Adding people is charged straight away. Reducing takes effect at the end of your current billing period."
          : "Changes apply immediately. Nothing is charged during your free trial."} />
      {isValidSeats(n) && (
        <p className="text-sm" aria-live="polite">New price: {formatPence(pricePence(n, interval))} + VAT per {interval}</p>
      )}
      <SubmitButton pending={pending}>Update team size</SubmitButton>
    </form>
  );
}
