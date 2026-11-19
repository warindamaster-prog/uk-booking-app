"use client";

import { useActionState } from "react";
import { anonymiseCustomer, withdrawConsent } from "./actions";
import { FormError } from "@/components/ui";
import type { FormState } from "@/lib/form";

const btn = "inline-flex min-h-11 items-center rounded-md border border-neutral-400 px-4 py-2 text-sm";

export function WithdrawConsentForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(withdrawConsent, {});
  return (
    <form action={action} className="space-y-2">
      <FormError message={state.error} />
      {state.message && <p role="status" className="text-sm text-green-800 dark:text-green-400">{state.message}</p>}
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending} className={btn}>Record that they withdrew consent</button>
    </form>
  );
}

export function DeleteCustomerForm({ id, name }: { id: string; name: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(anonymiseCustomer, {});
  return (
    <div className="space-y-3">
      <FormError message={state.error} />
      <details className="rounded-md border border-red-700 p-3">
        <summary className="cursor-pointer text-sm font-medium">Delete {name}&apos;s personal details</summary>
        <form action={action} className="mt-3 space-y-3">
          <input type="hidden" name="id" value={id} />
          <p className="text-sm">
            This removes their name, email address and phone number and any marketing consent. Their past bookings stay in your
            records (service, date and price) but are no longer linked to a person, and their booking links stop working.
            <strong> This can&apos;t be undone.</strong> Download their data first if they asked for a copy.
          </p>
          <button type="submit" disabled={pending}
            className="inline-flex min-h-11 items-center rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {pending ? "Please wait…" : "Yes, delete their details"}
          </button>
        </form>
      </details>
    </div>
  );
}
