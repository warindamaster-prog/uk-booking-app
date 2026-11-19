"use client";

import { useActionState } from "react";
import { updateSeats } from "./actions";
import { FormError } from "@/components/ui";
import type { FormState } from "@/lib/form";

/** Re-submits the current seat count, which cancels a scheduled reduction. */
export function CancelReductionForm({ current }: { current: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateSeats, {});
  return (
    <form action={action}>
      <FormError message={state.error} />
      <input type="hidden" name="seats" value={current} />
      <button type="submit" disabled={pending} className="text-sm underline">Keep my current plan instead</button>
    </form>
  );
}
