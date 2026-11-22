"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { shrinkImage } from "@/lib/shrink-image";
import { removeLogo, uploadLogo } from "./actions";

export function LogoManager({ url, initial }: { url: string | null; initial: string }) {
  const t = useT();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  async function onPick(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    setBusy(true); setError("");
    const fd = new FormData();
    fd.set("logo", await shrinkImage(f, 512, 400_000));
    const r = await uploadLogo(fd);
    if (r.error) setError(r.error);
    if (input.current) input.current.value = "";
    setBusy(false);
    router.refresh();
  }

  return (
    <section aria-labelledby="logo-h" className="space-y-3">
      <h2 id="logo-h" className="text-xl font-semibold">{t("Logo")}</h2>
      <div className="flex flex-wrap items-center gap-4">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" width={64} height={64} className="h-16 w-16 rounded-xl border border-neutral-300 object-cover" />
        ) : (
          <span aria-hidden="true" className="flex h-16 w-16 items-center justify-center rounded-xl bg-[color:var(--brand,#34553e)] text-2xl font-semibold text-[color:var(--brand-on,#fff)]">{initial}</span>
        )}
        <div className="space-y-1">
          <label htmlFor="logo-file" className={`inline-flex min-h-11 cursor-pointer items-center rounded-lg bg-[color:var(--brand,#34553e)] px-5 text-sm font-semibold text-[color:var(--brand-on,#fff)] focus-within:ring-2 focus-within:ring-[color:var(--brand-ring,#397451)] ${busy ? "pointer-events-none opacity-60" : ""}`}>
            {busy ? t("Uploading…") : url ? t("Change logo") : t("+ Add logo")}
            <input id="logo-file" ref={input} type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={(e) => onPick(e.target.files)} className="sr-only" />
          </label>
          {url && <button type="button" disabled={pending} onClick={() => start(async () => { await removeLogo(); router.refresh(); })} className="ml-3 min-h-11 text-sm text-red-700 underline dark:text-red-400">{t("Remove logo")}</button>}
          <p className="text-sm text-neutral-600 dark:text-neutral-400">{t("Shown in your dashboard and on your customers' booking pages. PNG, JPEG or WebP, square works best.")}</p>
        </div>
      </div>
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{t(error)}</p>}
    </section>
  );
}
