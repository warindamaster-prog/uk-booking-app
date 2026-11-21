"use client";

import { useActionState } from "react";
import { addLevel, deleteLevel, renameLevel } from "./actions";
import { Field, FormError, SubmitButton } from "@/components/ui";
import type { FormState } from "@/lib/form";
import { useT } from "@/lib/i18n/client";

export function AddLevelForm() {
  const t = useT();
  const [state, action, pending] = useActionState<FormState, FormData>(addLevel, {});
  return (
    <form action={action} className="space-y-4" noValidate key={state.message ?? "form"}>
      <FormError message={state.error} />
      {state.message && <p role="status" className="text-sm text-green-800 dark:text-green-400">{t(state.message)}</p>}
      <Field label="Level name" name="name" required maxLength={50} defaultValue={state.values?.name}
        hint="For example Junior, Senior or Director." errors={state.fieldErrors?.name} />
      <SubmitButton pending={pending}>Add level</SubmitButton>
    </form>
  );
}

export function LevelRow({ id, name, staffCount }: { id: string; name: string; staffCount: number }) {
  const t = useT();
  const [state, action, pending] = useActionState<FormState, FormData>(renameLevel, {});
  return (
    <li className="space-y-2 p-3">
      <form action={action} className="flex items-end gap-2" noValidate>
        <input type="hidden" name="id" value={id} />
        <div className="grow">
          <Field label="Level name" name="name" id={`level-name-${id}`} maxLength={50} defaultValue={state.values?.name ?? name} errors={state.fieldErrors?.name} />
        </div>
        <button type="submit" disabled={pending} className="min-h-11 rounded-md border border-neutral-400 px-3 text-sm">{t("Save")}</button>
      </form>
      <FormError message={state.error} />
      {state.message && <p role="status" className="text-sm text-green-800 dark:text-green-400">{t(state.message)}</p>}
      <div className="flex items-center justify-between text-sm">
        <span className="text-neutral-600 dark:text-neutral-400">{t(staffCount === 1 ? "{n} person" : "{n} people", { n: staffCount })}</span>
        <form action={deleteLevel}>
          <input type="hidden" name="id" value={id} />
          <button type="submit" className="underline">{t("Delete")}<span className="sr-only"> {name}</span></button>
        </form>
      </div>
    </li>
  );
}
