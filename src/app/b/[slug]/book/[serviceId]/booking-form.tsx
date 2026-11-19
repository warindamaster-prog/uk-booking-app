"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createPublicBooking } from "./actions";
import { Field, FormError, SubmitButton } from "@/components/ui";
import type { FormState } from "@/lib/form";

export function BookingForm({ slug, serviceId, staff, startsAt, privacyUrl, depositLabel }: {
  slug: string; serviceId: string; staff: string; startsAt: string; privacyUrl: string | null; depositLabel: string | null;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(createPublicBooking, {});
  const v = state.values ?? {};
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormError message={state.error} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="staff" value={staff} />
      <input type="hidden" name="startsAt" value={startsAt} />
      {/* Honeypot: hidden from people and assistive tech, bots tend to fill it. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>Website<input type="text" name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <Field label="Your name" name="name" required maxLength={100} autoComplete="name" defaultValue={v.name} errors={e.name} />
      <Field label="Email" name="email" type="email" required autoComplete="email" inputMode="email"
        hint="We'll use this to contact you about your booking." defaultValue={v.email} errors={e.email} />
      <Field label="Phone" name="phone" type="tel" required autoComplete="tel" inputMode="tel"
        defaultValue={v.phone} errors={e.phone} />
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="marketingConsent" defaultChecked={v.marketingConsent === "on"} className="mt-1 h-5 w-5" />
        <span>I&apos;d like to receive occasional offers and news by email. (Optional. You can unsubscribe at any time.)</span>
      </label>
      <p className="text-sm">
        We use your details only to manage your booking.{" "}
        {privacyUrl
          ? <a href={privacyUrl} className="underline" rel="noopener noreferrer">Read the privacy notice</a>
          : <Link href="/privacy" className="underline">Read the privacy notice</Link>}
        .
      </p>
      <SubmitButton pending={pending}>{depositLabel ?? "Confirm booking"}</SubmitButton>
    </form>
  );
}
