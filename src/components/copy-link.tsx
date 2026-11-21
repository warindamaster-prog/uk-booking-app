"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/client";

/** The booking link with a copy button. Falls back to selecting the text if the clipboard is blocked. */
export function CopyLink({ url }: { url: string }) {
  const t = useT();
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setState("copied");
    } catch {
      setState("failed");
    }
    setTimeout(() => setState("idle"), 2500);
  }
  return (
    <div>
      <div className="mt-3 flex min-h-11 items-center gap-1 rounded-lg border border-[color:var(--brand-border,#dce5cb)] bg-[color:var(--brand-softer,#f9fbf3)] pl-3">
        <span className="min-w-0 flex-1 select-all break-all py-2 text-xs text-[color:var(--brand-text,#587344)]">{url}</span>
        <button type="button" onClick={copy} className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-[color:var(--brand-text,#4a6736)] hover:bg-[color:var(--brand-soft,#edf2e1)]">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="8" y="8" width="13" height="13" rx="2" /><path d="M16 8V3H3v13h5" /></svg>
          {t("Copy")}
        </button>
      </div>
      <p role="status" aria-live="polite" className="mt-1 min-h-5 text-xs text-[color:var(--brand-text,#587344)]">
        {state === "copied" ? t("Link copied.") : state === "failed" ? t("Couldn't copy. Select the link and copy it.") : ""}
      </p>
    </div>
  );
}
