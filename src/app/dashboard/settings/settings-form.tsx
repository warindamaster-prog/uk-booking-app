"use client";

import { useActionState } from "react";
import { saveSettings } from "./actions";
import { Field, FormError, SubmitButton } from "@/components/ui";
import type { FormState } from "@/lib/form";
import { CANCELLATION_PRESETS, cancellationLabel } from "@/lib/validation/settings";

export function SettingsForm({ defaults }: {
  defaults: { ownerName: string; email: string; phone: string; cancellationHours: number; privacyUrl: string };
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveSettings, {});
  const v = state.values ?? {};
  const e = state.fieldErrors ?? {};
  const current = Number(v.cancellationHours ?? defaults.cancellationHours);
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

      <div className="space-y-1">
        <label htmlFor="cancellationHours" className="block text-sm font-medium">Customers can cancel online</label>
        <select id="cancellationHours" name="cancellationHours" defaultValue={String(current)}
          aria-describedby="cancel-hint" className="block w-full rounded-md border border-neutral-400 bg-transparent px-3 py-2 text-base">
          {options.map((h) => <option key={h} value={h}>{cancellationLabel(h)}</option>)}
        </select>
        <p id="cancel-hint" className="text-sm text-neutral-600 dark:text-neutral-400">
          After this point the cancel button disappears and customers are asked to contact you. You can always cancel or move a booking yourself.
        </p>
        {e.cancellationHours && <p className="text-sm text-red-700 dark:text-red-400">{e.cancellationHours[0]}</p>}
      </div>

      <Field label="Privacy notice address (optional)" name="privacyUrl" type="url" inputMode="url" autoCapitalize="none"
        hint="If you have your own privacy notice, customers are sent there. Otherwise they see a standard notice."
        defaultValue={v.privacyUrl ?? defaults.privacyUrl} errors={e.privacyUrl} />

      <SubmitButton pending={pending}>Save settings</SubmitButton>
    </form>
  );
}
