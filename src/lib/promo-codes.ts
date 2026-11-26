/**
 * Promotion codes for a longer free trial, entered when a shop signs up. They live in one setting, TRIAL_CODES, so a new offer needs no code change
 * and no database change:  "EMCHAMBER:90:2027-11-30:year,FRIEND:90"  means: code, days of free trial, optional last day the code works (UK date, inclusive),
 * optional plan the code is only for (month, year or three_year; the plan is chosen at sign-up and cannot be switched later).
 * Codes are not case sensitive. Nothing counts how often a code is used: the "new shop" email we get names the code that was used.
 */
export type PromoPlan = "month" | "year" | "three_year";
export type PromoCode = { code: string; days: number; lastDay: string | null; plan: PromoPlan | null };

const MAX_DAYS = 365;

export function parsePromoCodes(setting: string | undefined): PromoCode[] {
  return (setting ?? "").split(",").flatMap((part) => {
    const [code, days, lastDay, plan] = part.trim().split(":").map((x) => x.trim());
    const n = Number(days);
    if (!code || !/^[A-Za-z0-9_-]{2,40}$/.test(code) || !Number.isInteger(n) || n < 1 || n > MAX_DAYS) return [];
    if (lastDay && !/^\d{4}-\d{2}-\d{2}$/.test(lastDay)) return [];
    if (plan && !["month", "year", "three_year"].includes(plan)) return [];
    return [{ code: code.toUpperCase(), days: n, lastDay: lastDay || null, plan: (plan || null) as PromoPlan | null }];
  });
}

/** The free-trial days a typed code gives, or null if the code is unknown or its last day has passed. */
export function trialDaysForCode(typed: string, now: Date = new Date(), setting: string | undefined = process.env.TRIAL_CODES): { code: string; days: number; plan: PromoPlan | null } | null {
  const wanted = typed.trim().toUpperCase();
  if (!wanted) return null;
  const found = parsePromoCodes(setting).find((c) => c.code === wanted);
  if (!found) return null;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(now); // YYYY-MM-DD
  if (found.lastDay && today > found.lastDay) return null;
  return { code: found.code, days: found.days, plan: found.plan };
}
