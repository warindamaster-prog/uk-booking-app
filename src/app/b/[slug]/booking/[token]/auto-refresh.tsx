"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-checks the booking every few seconds (up to about 40 s) while we wait for Stripe to confirm the payment. */
export function AutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    let n = 0;
    const t = setInterval(() => { if (++n > 12) clearInterval(t); else router.refresh(); }, 3000);
    return () => clearInterval(t);
  }, [router]);
  return null;
}
