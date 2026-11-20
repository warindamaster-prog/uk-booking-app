import type { Metadata } from "next";
import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { StaffForm } from "./staff-forms";

export const metadata: Metadata = { title: "Staff" };

export default async function StaffPage() {
  const { supabase, business } = await requireOwner();
  const { data: staff } = await supabase
    .from("staff").select("id, name, email, active, level_id").eq("business_id", business.id).is("deleted_at", null)
    .order("active", { ascending: false }).order("sort_order").order("name");

  const { data: levels } = await supabase.from("staff_levels").select("id, name").eq("business_id", business.id).order("sort_order").order("name");
  const levelName = new Map((levels ?? []).map((l) => [l.id, l.name]));
  const { data: billing } = await supabase.from("business_billing").select("staff_seats, next_staff_seats").eq("business_id", business.id).maybeSingle();
  const used = (staff ?? []).filter((s) => s.active).length;

  return (
    <main className="space-y-10">
      <section aria-labelledby="staff-h">
        <h1 id="staff-h" className="mb-2 text-2xl font-semibold">Staff</h1>
        {billing && (
          <p className="mb-4 text-sm">
            {used} of {Math.min(billing.staff_seats, billing.next_staff_seats ?? billing.staff_seats)} team seats in use.{" "}
            <Link href="/dashboard/billing" className="underline">Change team size</Link>
            {billing.next_staff_seats !== null && billing.next_staff_seats < billing.staff_seats && (
              <span className="mt-1 block text-neutral-600 dark:text-neutral-400">
                You have paid for {billing.staff_seats} until your next billing period, but you planned a reduction to {billing.next_staff_seats}, so only {billing.next_staff_seats} can take bookings. To add someone now, cancel the planned reduction on the Billing page.
              </span>
            )}
          </p>
        )}
        <ul className="divide-y divide-neutral-300 rounded-md border border-neutral-300 dark:divide-neutral-700 dark:border-neutral-700">
          {staff?.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-4 p-3">
              <div>
                <p className="font-medium">{s.name}{s.level_id && levelName.get(s.level_id) && <span className="ml-2 text-sm font-normal text-neutral-600 dark:text-neutral-400">{levelName.get(s.level_id)}</span>}{!s.active && <span className="ml-2 text-sm text-neutral-600 dark:text-neutral-400">(not taking bookings)</span>}</p>
                {s.email && <p className="text-sm text-neutral-600 dark:text-neutral-400">{s.email}</p>}
              </div>
              <Link href={`/dashboard/staff/${s.id}`} className="text-sm underline">Manage<span className="sr-only"> {s.name}</span></Link>
            </li>
          ))}
        </ul>
      </section>
      <p className="text-sm">
        <Link href="/dashboard/staff/levels" className="underline">{levels?.length ? "Manage team levels" : "Set up team levels (optional)"}</Link>
        {!levels?.length && " if your prices depend on who does the work."}
      </p>
      <section aria-labelledby="add-h">
        <h2 id="add-h" className="mb-4 text-xl font-semibold">Add a team member</h2>
        <StaffForm defaults={{ name: "", email: "", active: true, description: "", levelId: "" }} levels={levels ?? []} />
      </section>
    </main>
  );
}
