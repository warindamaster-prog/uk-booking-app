"use client";

import { useActionState } from "react";
import { saveLevelPrices } from "./actions";
import { Field, FormError, SubmitButton } from "@/components/ui";
import type { FormState } from "@/lib/form";
import { useT } from "@/lib/i18n/client";

export function LevelPricesForm({ serviceId, standardPrice, levels }: {
  serviceId: string;
  standardPrice: string;
  levels: { id: string; name: string; price: string }[];
}) {
  const t = useT();
  const [state, action, pending] = useActionState<FormState, FormData>(saveLevelPrices, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormError message={state.error} />
      {state.message && <p role="status" className="rounded-md border border-green-700 p-3 text-sm text-green-800 dark:text-green-400">{t(state.message)}</p>}
      <input type="hidden" name="serviceId" value={serviceId} />
      <p className="text-sm">{t("Leave a box empty to use the standard price (£{price}).", { price: standardPrice })}</p>
      {levels.map((l) => (
        <Field key={l.id} label={t("{name} price (£)", { name: l.name })} name={`price-${l.id}`} inputMode="decimal"
          placeholder={standardPrice} defaultValue={state.values?.[`price-${l.id}`] ?? l.price} errors={state.fieldErrors?.[l.id]} />
      ))}
      <SubmitButton pending={pending}>Save level prices</SubmitButton>
    </form>
  );
}
