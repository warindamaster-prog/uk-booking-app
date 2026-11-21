"use client";

import { useT } from "@/lib/i18n/client";
import { LanguageSwitch } from "@/components/language-switch";
import type { InputHTMLAttributes, ReactNode } from "react";

export function Field({
  label, name, errors, hint, id: idProp, ...props
}: { label: string; name: string; errors?: string[]; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const t = useT();
  const id = idProp ?? name; // pass `id` when the same field name appears more than once on a page
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = errors?.length ? `${id}-error` : undefined;
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium">{t(label)}</label>
      <input
        id={id}
        name={name}
        aria-invalid={errId ? true : undefined}
        aria-describedby={[hintId, errId].filter(Boolean).join(" ") || undefined}
        className="block w-full rounded-md border border-neutral-400 bg-transparent px-3 py-2 text-base"
        {...props}
      />
      {hint && <p id={hintId} className="text-sm text-neutral-600 dark:text-neutral-400">{t(hint)}</p>}
      {errId && <p id={errId} className="text-sm text-red-700 dark:text-red-400">{t(errors![0])}</p>}
    </div>
  );
}

export function SubmitButton({ children, pending }: { children: ReactNode; pending?: boolean }) {
  const t = useT();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-neutral-900 px-4 py-3 text-base font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
    >
      {pending ? t("Please wait…") : typeof children === "string" ? t(children) : children}
    </button>
  );
}

export function FormError({ message }: { message?: string }) {
  const t = useT();
  if (!message) return null;
  return <p role="alert" className="rounded-md border border-red-700 p-3 text-sm text-red-700 dark:text-red-400">{t(message)}</p>;
}

export function Shell({ title, children }: { title: string; children: ReactNode }) {
  const t = useT();
  return (
    <main className="mx-auto w-full max-w-md px-4 py-10">
      <div className="mb-4 flex justify-end"><LanguageSwitch /></div>
      <h1 className="mb-6 text-2xl font-semibold">{t(title)}</h1>
      {children}
    </main>
  );
}
