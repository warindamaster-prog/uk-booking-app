"use client";

import { useActionState, useRef, useState } from "react";
import { updateSeats } from "./actions";
import { Field, FormError, SubmitButton } from "@/components/ui";
import type { FormState } from "@/lib/form";
import { formatPence } from "@/lib/money";
import { isValidSeats, pricePence, type BillingInterval } from "@/lib/pricing";
import { describeSeatChange, summariseSeatChange } from "@/lib/seat-change";
import { planSeatChange } from "@/lib/stripe/billing";
import { useT } from "@/lib/i18n/client";

export function SeatsForm({ current, scheduled, interval, hasSubscription, periodEnd, periodEndLabel, noTrial = false }: {
  /** Seats paid for now. */
  current: number;
  /** A reduction already planned for the next period, if any. */
  scheduled: number | null;
  interval: BillingInterval;
  hasSubscription: boolean;
  periodEnd: string | null;
  periodEndLabel: string | null;
  noTrial?: boolean;
}) {
  const t = useT();
  const [state, action, pending] = useActionState<FormState, FormData>(updateSeats, {});
  const [text, setText] = useState(String(scheduled ?? current));
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const confirmed = useRef(false);

  const n = /^\d+$/.test(text) ? Number(text) : NaN;
  const valid = isValidSeats(n);
  const plan = valid ? planSeatChange({ current, scheduled, requested: n, hasSubscription }) : "noop";
  const summary = valid
    ? summariseSeatChange({ plan, current, requested: n, interval, periodEnd: periodEnd ? new Date(periodEnd) : null, now: new Date() })
    : null;
  const popup = summary && plan !== "noop" ? describeSeatChange(summary, { current, requested: n, interval, periodEndLabel, noTrial }, t) : null;

  return (
    <>
      <form ref={form} action={action} noValidate className="space-y-4"
        onSubmit={(e) => {
          if (confirmed.current || !popup) { confirmed.current = false; return; } // confirmed, or nothing to confirm
          e.preventDefault();
          dialog.current?.showModal();
        }}>
        <FormError message={state.error} />
        {state.message && <p role="status" className="rounded-md border border-green-700 p-3 text-sm text-green-800 dark:text-green-400">{t(state.message)}</p>}
        <Field label="People who take bookings" name="seats" inputMode="numeric" required value={text}
          onChange={(e) => setText(e.target.value)} errors={state.fieldErrors?.seats}
          hint={hasSubscription
            ? "Adding people is charged straight away. Reducing takes effect at the end of your current billing period."
            : (noTrial ? "Changes apply immediately. Nothing is charged until you subscribe." : "Changes apply immediately. Nothing is charged during your free trial.")} />
        {valid && <p className="text-sm" aria-live="polite">{t("Plan price: {price} + VAT per {interval}", { price: formatPence(pricePence(n, interval)), interval: t(interval) })}</p>}
        <SubmitButton pending={pending}>Update team size</SubmitButton>
      </form>

      <dialog ref={dialog} aria-labelledby="seat-popup-h"
        className="m-auto w-[min(92vw,28rem)] rounded-lg border border-neutral-400 bg-white p-5 text-neutral-900 backdrop:bg-black/50 dark:bg-neutral-900 dark:text-white">
        {popup && (
          <div className="space-y-3">
            <h2 id="seat-popup-h" className="text-lg font-semibold">{popup.title}</h2>
            {popup.lines.map((l) => <p key={l} className="text-sm">{l}</p>)}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => dialog.current?.close()}
                className="inline-flex min-h-11 items-center rounded-md border border-neutral-400 px-4 py-2 text-sm">{t("Cancel")}</button>
              <button type="button" disabled={pending}
                onClick={() => { confirmed.current = true; dialog.current?.close(); form.current?.requestSubmit(); }}
                className="inline-flex min-h-11 items-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">
                {popup.confirm}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
