"use client";

import { useActionState, useState, useTransition } from "react";
import { removeEmailSettings, saveEmailSettings } from "./actions";
import { Field, FormError, SubmitButton } from "@/components/ui";
import type { FormState } from "@/lib/form";
import { EMAIL_PRESETS } from "@/lib/email-presets";
import { useT } from "@/lib/i18n/client";

type Saved = { host: string; port: number; user: string; fromName: string };

export function EmailSettingsForm({ saved }: { saved: Saved | null }) {
  const t = useT();
  const [state, action, pending] = useActionState<FormState, FormData>(saveEmailSettings, {});
  const [removed, setRemoved] = useState<FormState>({});
  const [removing, startRemove] = useTransition();
  const v = state.values ?? {};
  const e = state.fieldErrors ?? {};
  const [host, setHost] = useState(v.host ?? saved?.host ?? "");
  const [port, setPort] = useState(v.port ?? String(saved?.port ?? 587));
  const preset = EMAIL_PRESETS.find((p) => p.host && p.host === host) ?? EMAIL_PRESETS[2];

  return (
    <div className="space-y-6">
      {saved && !state.message && !removed.message && (
        <p role="status" className="rounded-md border border-green-700 p-3 text-sm text-green-800 dark:text-green-400">
          {t("Customers' emails are sent from")} <strong>{saved.user}</strong>.
        </p>
      )}
      {removed.message && <p role="status" className="rounded-md border border-green-700 p-3 text-sm">{t(removed.message)}</p>}
      <form action={action} className="space-y-5" noValidate>
        <FormError message={state.error} />
        {state.message && <p role="status" className="rounded-md border border-green-700 p-3 text-sm text-green-800 dark:text-green-400">{t(state.message)}</p>}

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{t("Your email provider")}</legend>
          <div className="flex flex-wrap gap-2">
            {EMAIL_PRESETS.map((p) => (
              <button key={p.id} type="button" aria-pressed={preset.id === p.id}
                onClick={() => { setHost(p.host); setPort(String(p.port)); }}
                className={`min-h-11 rounded-md border px-3 py-2 text-sm ${preset.id === p.id ? "border-neutral-900 bg-neutral-100 font-medium dark:border-neutral-100 dark:bg-neutral-800" : "border-neutral-400"}`}>
                {p.label}
              </button>
            ))}
          </div>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">{preset.help}</p>
        </fieldset>

        <Field label="Outgoing mail server" name="host" required value={host} onChange={(ev) => setHost(ev.target.value)}
          autoCapitalize="none" autoComplete="off" errors={e.host} />
        <div className="space-y-1">
          <label htmlFor="port" className="block text-sm font-medium">{t("Port")}</label>
          <select id="port" name="port" value={port} onChange={(ev) => setPort(ev.target.value)}
            className="block w-full rounded-md border border-neutral-400 bg-transparent px-3 py-2 text-base">
            <option value="587">{t("587 (most common)")}</option>
            <option value="465">465</option>
            <option value="2525">2525</option>
          </select>
          {e.port && <p className="text-sm text-red-700 dark:text-red-400">{t(e.port[0])}</p>}
        </div>
        <Field label="Your email address" name="user" type="email" required autoComplete="off"
          defaultValue={v.user ?? saved?.user ?? ""} errors={e.user} />
        <Field label="Password" name="pass" type="password" autoComplete="new-password"
          hint={saved ? "Leave blank to keep the saved password. We store it encrypted and never show it again." : "We store it encrypted and never show it again."}
          errors={e.pass} />
        <Field label="Name customers see (optional)" name="fromName" maxLength={100}
          hint="Defaults to your business name." defaultValue={v.fromName ?? saved?.fromName ?? ""} errors={e.fromName} />

        <SubmitButton pending={pending}>{pending ? t("Sending a test email…") : t("Save and send a test email")}</SubmitButton>
      </form>

      {saved && (
        <div>
          <button type="button" disabled={removing}
            onClick={() => { if (window.confirm(t("Stop sending from your own mailbox? Customers' emails will come from our standard sender."))) startRemove(async () => setRemoved(await removeEmailSettings())); }}
            className="min-h-11 rounded-md border border-red-700 px-4 py-2 text-sm text-red-800 dark:text-red-400">
            {t("Stop using my mailbox")}
          </button>
        </div>
      )}
    </div>
  );
}
