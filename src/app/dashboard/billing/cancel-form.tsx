"use client";

import { useActionState } from "react";
import { keepCurrentPlan } from "./actions";
import { FormError } from "@/components/ui";
import type { FormState } from "@/lib/form";
import { useT } from "@/lib/i18n/client";

/** Cancels every planned reduction (team size and SMS packs) so the plan stays as it is. */
export function CancelReductionForm() {
  const t = useT();
  const [state, action, pending] = useActionState<FormState, FormData>(keepCurrentPlan, {});
  return (
    <form action={action}>
      <FormError message={state.error} />
      {state.message && <p role="status" className="text-sm text-green-800 dark:text-green-400">{t(state.message)}</p>}
      <button type="submit" disabled={pending} className="text-sm underline">{t("Keep my current plan instead")}</button>
    </form>
  );
}
