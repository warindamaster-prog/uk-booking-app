"use client";

import { useActionState } from "react";
import { sendSupportMessage } from "./actions";
import { Field, FormError, SubmitButton } from "@/components/ui";
import type { FormState } from "@/lib/form";
import { SUPPORT_TOPICS } from "@/lib/support";

export function SupportForm({ defaultEmail }: { defaultEmail: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(sendSupportMessage, {});
  const v = state.values;
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormError message={state.error} />
      {state.message && <p role="status" className="rounded-md border border-green-700 p-3 text-sm text-green-800 dark:text-green-400">{state.message}</p>}
      <div className="space-y-1">
        <label htmlFor="topic" className="block text-sm font-medium">What is it about?</label>
        <select id="topic" name="topic" defaultValue={v?.topic ?? "other"}
          className="block w-full rounded-md border border-neutral-400 bg-transparent px-3 py-2 text-base">
          {Object.entries(SUPPORT_TOPICS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
      </div>
      <div className="space-y-1">
        <label htmlFor="message" className="block text-sm font-medium">Your message</label>
        <textarea id="message" name="message" rows={6} maxLength={3000} required defaultValue={v?.message}
          aria-invalid={state.fieldErrors?.message ? true : undefined}
          className="block w-full rounded-md border border-neutral-400 bg-transparent px-3 py-2 text-base" />
        <p className="text-sm text-neutral-600 dark:text-neutral-400">What were you trying to do, and what happened instead? Never include passwords or card numbers.</p>
        {state.fieldErrors?.message && <p className="text-sm text-red-700 dark:text-red-400">{state.fieldErrors.message[0]}</p>}
      </div>
      <Field label="Where should we reply?" name="replyTo" type="email" autoComplete="email" required
        defaultValue={v?.replyTo ?? defaultEmail} errors={state.fieldErrors?.replyTo} />
      <SubmitButton pending={pending}>Send message</SubmitButton>
    </form>
  );
}
