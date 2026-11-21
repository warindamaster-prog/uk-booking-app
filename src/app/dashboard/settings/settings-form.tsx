"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { fillMessage, PLACEHOLDERS } from "@/lib/notifications/message";
import { saveSettings } from "./actions";
import { Field, FormError, SubmitButton } from "@/components/ui";
import type { FormState } from "@/lib/form";
import { CANCELLATION_PRESETS, cancellationLabel } from "@/lib/validation/settings";
import { depositPolicyText } from "@/lib/deposit-policy";

export function SettingsForm({ defaults, shopName }: {
  shopName: string;
  defaults: { confirmationMessage: string; ownerName: string; email: string; phone: string; cancellationHours: number; privacyUrl: string; showContact: boolean; depositPolicy: string; depositRefundable: boolean };
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveSettings, {});
  const v = state.values ?? {};
  const e = state.fieldErrors ?? {};
  const [message, setMessage] = useState(v.confirmationMessage ?? defaults.confirmationMessage);
  const preview = fillMessage(message, {
    customerName: "Sam Taylor", serviceName: "Gel manicure", staffName: "Alex", businessName: shopName,
    startsAt: new Date("2027-03-12T14:30:00Z"), tz: "Europe/London" });
  const [policy, setPolicy] = useState(v.depositPolicy ?? defaults.depositPolicy);
  const [refundable, setRefundable] = useState((v.depositRefundable ?? (defaults.depositRefundable ? "yes" : "no")) === "yes");
  const current = Number(v.cancellationHours ?? defaults.cancellationHours);
  const [hours, setHours] = useState(current); // follows the select so the preview updates as the owner chooses
  const options = [...new Set([...CANCELLATION_PRESETS, defaults.cancellationHours])].sort((a, b) => a - b);

  return (
    <form action={action} className="space-y-5" noValidate>
      <FormError message={state.error} />
      {state.message && <p role="status" className="rounded-md border border-green-700 p-3 text-sm text-green-800 dark:text-green-400">{state.message}</p>}

      <Field label="Owner's name" name="ownerName" required maxLength={100} autoComplete="name" defaultValue={v.ownerName ?? defaults.ownerName} errors={e.ownerName} />
      <Field label="Contact email" name="email" type="email" required autoComplete="email"
        hint="New booking and cancellation emails are sent here, and customers' replies come here."
        defaultValue={v.email ?? defaults.email} errors={e.email} />
      <Field label="Phone number" name="phone" type="tel" required autoComplete="tel" defaultValue={v.phone ?? defaults.phone} errors={e.phone} />

      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="showContact" defaultChecked={v.showContact !== undefined ? v.showContact === "on" : defaults.showContact} className="mt-1 h-5 w-5" />
        <span>
          Show my contact email and phone to customers (in their emails and on their booking page).
          <span className="block text-neutral-600 dark:text-neutral-400">Customers who reply to an email always reach your contact email, whether this is on or off.</span>
        </span>
      </label>

      <div className="space-y-1">
        <label htmlFor="confirmationMessage" className="block text-sm font-medium">Your message to customers (optional)</label>
        <textarea id="confirmationMessage" name="confirmationMessage" rows={5} maxLength={1000} value={message}
          onChange={(ev) => setMessage(ev.target.value)} aria-describedby="msg-hint"
          className="block w-full rounded-md border border-neutral-400 bg-transparent px-3 py-2 text-base" />
        <p id="msg-hint" className="text-sm text-neutral-600 dark:text-neutral-400">
          Added to confirmation and reminder emails. You can use {PLACEHOLDERS.map((p) => `{{${p}}}`).join(", ")}; each is filled in from the booking.
        </p>
        {e.confirmationMessage && <p className="text-sm text-red-700 dark:text-red-400">{e.confirmationMessage[0]}</p>}
        {message.trim() && (
          <div className="rounded-md border border-neutral-300 p-3 text-sm dark:border-neutral-700" aria-live="polite">
            <p className="mb-1 font-medium">Preview (example booking)</p>
            <p className="whitespace-pre-wrap">{preview}</p>
          </div>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="cancellationHours" className="block text-sm font-medium">Customers can cancel online</label>
        <select id="cancellationHours" name="cancellationHours" defaultValue={String(current)} onChange={(ev) => setHours(Number(ev.target.value))}
          aria-describedby="cancel-hint" className="block w-full rounded-md border border-neutral-400 bg-transparent px-3 py-2 text-base">
          {options.map((h) => <option key={h} value={h}>{cancellationLabel(h)}</option>)}
        </select>
        <p id="cancel-hint" className="text-sm text-neutral-600 dark:text-neutral-400">
          After this point the cancel button disappears and customers are asked to contact you. You can always cancel or move a booking yourself.
        </p>
        {e.cancellationHours && <p className="text-sm text-red-700 dark:text-red-400">{e.cancellationHours[0]}</p>}
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Deposits when a customer cancels online</legend>
        <label className="flex items-start gap-3 text-sm">
          <input type="radio" name="depositRefundable" value="yes" defaultChecked={refundable} onChange={() => setRefundable(true)} className="mt-1 h-5 w-5" />
          <span>Refund the deposit automatically (if they cancel in time, as set above).</span>
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input type="radio" name="depositRefundable" value="no" defaultChecked={!refundable} onChange={() => setRefundable(false)} className="mt-1 h-5 w-5" />
          <span>Keep the deposit whenever a customer cancels. You can still refund a deposit yourself from the booking.</span>
        </label>
      </fieldset>

      <div className="space-y-1">
        <label htmlFor="depositPolicy" className="block text-sm font-medium">Deposit and cancellation policy (optional)</label>
        <textarea id="depositPolicy" name="depositPolicy" rows={4} maxLength={600} value={policy}
          onChange={(ev) => setPolicy(ev.target.value)} aria-describedby="policy-hint"
          className="block w-full rounded-md border border-neutral-400 bg-transparent px-3 py-2 text-base" />
        <p id="policy-hint" className="text-sm text-neutral-600 dark:text-neutral-400">
          Shown to customers before they pay a deposit, and in their confirmation and reminder emails. Leave it empty to use the standard sentence below. Make sure it matches the choice above.
        </p>
        {e.depositPolicy && <p className="text-sm text-red-700 dark:text-red-400">{e.depositPolicy[0]}</p>}
        <div className="rounded-md border border-neutral-300 p-3 text-sm dark:border-neutral-700" aria-live="polite">
          <p className="mb-1 font-medium">What customers will see</p>
          <p className="whitespace-pre-wrap">{depositPolicyText({ policy, refundable, windowHours: hours, businessName: shopName })}</p>
        </div>
      </div>

      <Field label="Privacy notice address (optional)" name="privacyUrl" type="url" inputMode="url" autoCapitalize="none"
        hint="If you have your own privacy notice, customers are sent there. Otherwise they see a standard notice."
        defaultValue={v.privacyUrl ?? defaults.privacyUrl} errors={e.privacyUrl} />

      <SubmitButton pending={pending}>Save settings</SubmitButton>
      <p className="text-sm"><Link href="/dashboard/settings/email" className="underline">Send customers&apos; emails from your own email address</Link></p>
    </form>
  );
}
