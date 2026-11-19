"use client";

import { useActionState, useRef, useState } from "react";
import { setSmsEnabled, updateSmsPacks } from "./actions";
import { Field, FormError, SubmitButton } from "@/components/ui";
import type { FormState } from "@/lib/form";
import { formatPence } from "@/lib/money";
import { isValidSmsPacks, PRICING, smsPackPricePence, type BillingInterval } from "@/lib/pricing";
import { describeSmsChange, summariseSmsChange } from "@/lib/seat-change";
import { planSeatChange } from "@/lib/stripe/billing";

export function SmsForm({ current, scheduled, enabled, seats, interval, hasSubscription, periodEnd, periodEndLabel }: {
  /** SMS packs paid for now. */
  current: number;
  /** A reduction already planned for the next period, if any. */
  scheduled: number | null;
  enabled: boolean;
  /** Team seats the plan will have next period (used to show the whole plan price). */
  seats: number;
  interval: BillingInterval;
  hasSubscription: boolean;
  periodEnd: string | null;
  periodEndLabel: string | null;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateSmsPacks, {});
  const [toggle, toggleAction, toggling] = useActionState<FormState, FormData>(setSmsEnabled, {});
  const [text, setText] = useState(String(scheduled ?? current));
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const confirmed = useRef(false);

  const n = /^\d+$/.test(text) ? Number(text) : NaN;
  const valid = isValidSmsPacks(n);
  const plan = valid ? planSeatChange({ current, scheduled, requested: n, hasSubscription }) : "noop";
  const summary = valid
    ? summariseSmsChange({ plan, current, requested: n, seats, interval, periodEnd: periodEnd ? new Date(periodEnd) : null, now: new Date() })
    : null;
  const popup = summary && plan !== "noop" ? describeSmsChange(summary, { current, requested: n, interval, periodEndLabel }) : null;
  const unit = smsPackPricePence(interval);

  return (
    <div className="space-y-6">
      <p className="text-sm">
        Text your customers a booking confirmation as well as the email. Each pack is <strong>{formatPence(unit)} + VAT per {interval}</strong> and
        covers {PRICING.smsPackTexts} texts a month. Unused texts don&apos;t carry over. If you run out, texts stop but emails keep going.
      </p>
      <p role="note" className="rounded-md bg-neutral-100 p-3 text-sm dark:bg-neutral-800">
        Texts aren&apos;t being sent yet. You can choose your packs now; we&apos;ll switch sending on soon and won&apos;t charge for texts before then.
      </p>

      <form ref={form} action={action} noValidate className="space-y-4"
        onSubmit={(e) => {
          if (confirmed.current || !popup) { confirmed.current = false; return; }
          e.preventDefault();
          dialog.current?.showModal();
        }}>
        <FormError message={state.error} />
        {state.message && <p role="status" className="rounded-md border border-green-700 p-3 text-sm text-green-800 dark:text-green-400">{state.message}</p>}
        <Field label="SMS packs" name="packs" inputMode="numeric" required value={text}
          onChange={(e) => setText(e.target.value)} errors={state.fieldErrors?.packs}
          hint={hasSubscription
            ? `0 to ${PRICING.maxSmsPacks}. Adding packs is charged straight away. Reducing takes effect at the end of your current billing period.`
            : `0 to ${PRICING.maxSmsPacks}. Changes apply immediately. Nothing is charged during your free trial.`} />
        {valid && <p className="text-sm" aria-live="polite">{n} {n === 1 ? "pack" : "packs"} = {n * PRICING.smsPackTexts} texts a month, {formatPence(n * unit)} + VAT per {interval}</p>}
        <SubmitButton pending={pending}>Update SMS packs</SubmitButton>
      </form>

      {current > 0 && (
        <form action={toggleAction} className="space-y-2">
          <FormError message={toggle.error} />
          {toggle.message && <p role="status" className="text-sm text-green-800 dark:text-green-400">{toggle.message}</p>}
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" name="enabled" defaultChecked={enabled} className="h-5 w-5" />
            Send an SMS confirmation to customers when they book
          </label>
          <SubmitButton pending={toggling}>Save</SubmitButton>
        </form>
      )}

      <dialog ref={dialog} aria-labelledby="sms-popup-h"
        className="m-auto w-[min(92vw,28rem)] rounded-lg border border-neutral-400 bg-white p-5 text-neutral-900 backdrop:bg-black/50 dark:bg-neutral-900 dark:text-white">
        {popup && (
          <div className="space-y-3">
            <h2 id="sms-popup-h" className="text-lg font-semibold">{popup.title}</h2>
            {popup.lines.map((l) => <p key={l} className="text-sm">{l}</p>)}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => dialog.current?.close()}
                className="inline-flex min-h-11 items-center rounded-md border border-neutral-400 px-4 py-2 text-sm">Cancel</button>
              <button type="button" disabled={pending}
                onClick={() => { confirmed.current = true; dialog.current?.close(); form.current?.requestSubmit(); }}
                className="inline-flex min-h-11 items-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">
                {popup.confirm}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}
