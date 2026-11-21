"use client";

import { useActionState } from "react";
import { cancelMyBooking } from "./actions";
import { FormError } from "@/components/ui";
import type { FormState } from "@/lib/form";

export function CancelForm({ slug, token, depositNote }: { slug: string; token: string; depositNote?: string | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(cancelMyBooking, {});
  return (
    <div className="space-y-3">
      <FormError message={state.error} />
      {state.message && <p role="status" className="rounded-md border border-green-700 p-3 text-sm text-green-800 dark:text-green-400">{state.message}</p>}
      <details className="rounded-md border border-neutral-300 p-3 dark:border-neutral-700">
        <summary className="cursor-pointer text-sm font-medium">Cancel this booking</summary>
        <form action={action} className="mt-3 space-y-3">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="token" value={token} />
          <p className="text-sm">The time will be released for other customers.{depositNote ? ` ${depositNote}` : ""}</p>
          <button type="submit" disabled={pending}
            className="inline-flex min-h-11 items-center rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {pending ? "Please wait…" : "Yes, cancel my booking"}
          </button>
        </form>
      </details>
    </div>
  );
}
