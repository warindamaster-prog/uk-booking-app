"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { shrinkImage } from "@/lib/shrink-image";
import { deletePhoto, makeCover, uploadPhoto } from "./actions";

type Photo = { id: string; url: string };

export function PhotoManager({ photos, max }: { photos: Photo[]; max: number }) {
  const t = useT();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  // Buttons, not forms: this component sits inside the page's main form.
  function run(action: (fd: FormData) => Promise<void>, id: string) {
    const fd = new FormData();
    fd.set("id", id);
    start(async () => { await action(fd); router.refresh(); });
  }

  async function onPick(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true); setError("");
    for (const f of Array.from(files)) {
      const fd = new FormData();
      fd.set("photo", await shrinkImage(f, 1800));
      const r = await uploadPhoto(fd);
      if (r.error) { setError(r.error); break; }
    }
    if (input.current) input.current.value = "";
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {photos.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((p, i) => (
            <li key={p.id} className="space-y-2 rounded-lg border border-neutral-300 p-2 dark:border-neutral-700">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" className="aspect-[4/3] w-full rounded-md object-cover" />
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                {i === 0 ? <span className="font-medium">{t("Cover photo")}</span> : (
                  <button type="button" disabled={pending} onClick={() => run(makeCover, p.id)} className="min-h-11 underline">{t("Make cover")}</button>
                )}
                <button type="button" disabled={pending} onClick={() => run(deletePhoto, p.id)} className="min-h-11 text-red-700 underline dark:text-red-400">{t("Delete")}</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {photos.length < max && (
        <div>
          <label htmlFor="photos" className={`flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-neutral-400 px-4 py-5 text-center transition hover:border-[color:var(--brand,#34553e)] hover:bg-[color:var(--brand-softer,#f4f6ef)] focus-within:ring-2 focus-within:ring-[color:var(--brand-ring,#397451)] ${busy ? "pointer-events-none opacity-60" : ""}`}>
            <span className="inline-flex min-h-11 items-center rounded-lg bg-[color:var(--brand,#34553e)] px-5 text-sm font-semibold text-[color:var(--brand-on,#fff)]">{busy ? t("Uploading…") : t("+ Add photos")}</span>
            <span className="text-sm text-neutral-600 dark:text-neutral-400">{t("Click to choose photos from your device. You can pick several at once.")}</span>
            <input id="photos" ref={input} type="file" multiple accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={(e) => onPick(e.target.files)} className="sr-only" />
          </label>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{t("PNG, JPEG or WebP. The first photo is shown at the top of your page. Up to {n} photos.", { n: String(max) })}</p>
          {busy && <p role="status" className="sr-only">{t("Uploading…")}</p>}
        </div>
      )}
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{t(error)}</p>}
    </div>
  );
}
