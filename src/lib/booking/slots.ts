import type { Interval, Slot } from "../availability";

export type LiveBookingRow = {
  staff_id: string;
  starts_at: string | Date;
  ends_at: string | Date;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  status: string;
  hold_expires_at: string | Date | null;
};

const LIVE = new Set(["confirmed", "completed", "no_show"]);

/** Live = confirmed/completed/no_show, or an unpaid hold that hasn't expired. Cancelled/expired never block. */
export function isLive(b: Pick<LiveBookingRow, "status" | "hold_expires_at">, now: Date): boolean {
  if (LIVE.has(b.status)) return true;
  return b.status === "pending_payment" && !!b.hold_expires_at && new Date(b.hold_expires_at) > now;
}

/** Same range the database computes for the exclusion constraint. */
export function blockedInterval(b: LiveBookingRow): Interval {
  return {
    start: new Date(new Date(b.starts_at).getTime() - b.buffer_before_minutes * 60000),
    end: new Date(new Date(b.ends_at).getTime() + b.buffer_after_minutes * 60000),
  };
}

/** Staff to try, in order, for a chosen slot. "any" tries everyone free (least busy first). */
export function candidateStaff(slot: Slot | undefined, choice: "any" | string): string[] {
  if (!slot) return [];
  if (choice === "any") return slot.staffIds;
  return slot.staffIds.includes(choice) ? [choice] : [];
}
