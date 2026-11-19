import Link from "next/link";
import { displayStatus, STATUS_LABEL } from "@/lib/calendar";
import type { BookingView } from "@/lib/dashboard/bookings";
import { formatPence } from "@/lib/money";
import { formatDateTime, formatTime } from "@/lib/time";

export function BookingCard({ b, tz, showStaff = true, showDate = false, compact = false }: {
  b: BookingView; tz: string; showStaff?: boolean; showDate?: boolean; compact?: boolean;
}) {
  const shown = displayStatus(b);
  const when = showDate ? formatDateTime(b.starts_at, tz) : `${formatTime(b.starts_at, tz)} – ${formatTime(b.ends_at, tz)}`;
  return (
    <Link href={`/dashboard/bookings/${b.id}`}
      className="block rounded-md border border-neutral-300 p-3 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900">
      <span className="flex items-baseline justify-between gap-2">
        <span className="font-medium">{when}</span>
        {shown !== "confirmed" && <span className="rounded border border-neutral-400 px-1.5 text-xs">{STATUS_LABEL[shown] ?? shown}</span>}
      </span>
      <span className="block">{b.customer?.name ?? "Customer"}</span>
      <span className="block text-neutral-600 dark:text-neutral-400">
        {b.service_name}{!compact && ` · ${formatPence(b.price_pence)}`}{showStaff && ` · ${b.staffName}`}
      </span>
    </Link>
  );
}
