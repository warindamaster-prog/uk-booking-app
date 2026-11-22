"use client";

import { useEffect, useRef, useState } from "react";

type Photo = { id: string; url: string };

function Lightbox({ photos, index, setIndex, name }: { photos: Photo[]; index: number | null; setIndex: (i: number | null) => void; name: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (index === null) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIndex(null);
      if (e.key === "ArrowRight") setIndex(((index ?? 0) + 1) % photos.length);
      if (e.key === "ArrowLeft") setIndex(((index ?? 0) - 1 + photos.length) % photos.length);
    };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", onKey); previous?.focus(); };
  }, [index, photos.length, setIndex]);
  if (index === null) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#17231ccc] p-4" onClick={() => setIndex(null)}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`${name} photos`} onClick={(e) => e.stopPropagation()}
        className="max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-[color:var(--brand-bg,#fafbf7)] p-4 shadow-xl outline-none sm:p-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="text-sm text-[color:var(--brand-muted,#6b756d)]">{index + 1} / {photos.length}</span>
          <button onClick={() => setIndex(null)} className="min-h-11 rounded-lg px-4 text-sm font-semibold hover:bg-black/5">Close</button>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photos[index].url} alt={`${name} photo ${index + 1}`} className="max-h-[68dvh] w-full rounded-xl object-contain" />
        {photos.length > 1 && (
          <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6">
            {photos.map((p, i) => (
              <button key={p.id} onClick={() => setIndex(i)} aria-label={`Show photo ${i + 1}`} aria-pressed={i === index}
                className={`aspect-[4/3] overflow-hidden rounded-lg ${i === index ? "ring-2 ring-[color:var(--brand,#48613d)] ring-offset-2" : ""}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** The top of the page: one big photo and up to two beside it. Clicking opens all photos. */
export function HeroPhotos({ photos, name }: { photos: Photo[]; name: string }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!photos.length) return null;
  const side = photos.slice(1, 3);
  const btn = "min-h-0 overflow-hidden focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-white";
  return (
    <section aria-label={`${name} photos`} className={`relative grid h-[260px] grid-cols-1 gap-2 overflow-hidden rounded-2xl md:h-[400px] ${side.length ? "md:grid-cols-[1.65fr_1fr]" : ""}`}>
      <button aria-label="View photo 1" onClick={() => setOpen(0)} className={btn}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photos[0].url} alt={name} className="h-full w-full object-cover transition duration-500 hover:scale-105" />
      </button>
      {side.length > 0 && (
        <div className={`hidden min-h-0 gap-2 md:grid ${side.length === 2 ? "grid-rows-2" : "grid-rows-1"}`}>
          {side.map((p, i) => (
            <button key={p.id} aria-label={`View photo ${i + 2}`} onClick={() => setOpen(i + 1)} className={btn}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" className="h-full w-full object-cover transition duration-500 hover:scale-105" />
            </button>
          ))}
        </div>
      )}
      {photos.length > 1 && (
        <button onClick={() => setOpen(0)} className="absolute bottom-4 right-4 inline-flex min-h-11 items-center rounded-lg border border-stone-200 bg-white px-4 text-sm font-semibold text-[#293a2e] shadow-sm hover:bg-stone-50">View all photos</button>
      )}
      <Lightbox photos={photos} index={open} setIndex={setOpen} name={name} />
    </section>
  );
}

/** The gallery section: a grid of all photos. */
export function PhotoGrid({ photos, name }: { photos: Photo[]; name: string }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!photos.length) return null;
  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {photos.map((p, i) => (
          <button key={p.id} aria-label={`Enlarge photo ${i + 1}`} onClick={() => setOpen(i)} className="aspect-[4/5] overflow-hidden rounded-xl focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring,#48613d)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={`${name} photo ${i + 1}`} loading="lazy" className="h-full w-full object-cover transition duration-300 hover:scale-105" />
          </button>
        ))}
      </div>
      <Lightbox photos={photos} index={open} setIndex={setOpen} name={name} />
    </>
  );
}
