"use client";

import { useActionState } from "react";
import { saveLevelPrices } from "./actions";
import { Field, FormError, SubmitButton } from "@/components/ui";
import type { FormState } from "@/lib/form";

export function LevelPricesForm({ serviceId, standardPrice, levels }: {
  serviceId: string;
  standardPrice: string;
  levels: { id: string; name: string; price: string }[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveLevelPrices, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormError message={state.error} />
      {state.message && <p role="status" className="rounded-md border border-green-700 p-3 text-sm text-green-800 dark:text-green-400">{state.message}</p>}
      <input type="hidden" name="serviceId" value={serviceId} />
      <p className="text-sm">Leave a box empty to use the standard price (£{standardPrice}).</p>
      {levels.map((l) => (
        <Field key={l.id} label={`${l.name} price (£)`} name={`price-${l.id}`} inputMode="decimal"
          placeholder={standardPrice} defaultValue={state.values?.[`price-${l.id}`] ?? l.price} errors={state.fieldErrors?.[l.id]} />
      ))}
      <SubmitButton pending={pending}>Save level prices</SubmitButton>
    </form>
  );
}
