import type { Metadata } from "next";
import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { AddLevelForm, LevelRow } from "./level-forms";

export const metadata: Metadata = { title: "Team levels" };

export default async function LevelsPage() {
  const { supabase, business } = await requireOwner();
  const [{ data: levels }, { data: staff }] = await Promise.all([
    supabase.from("staff_levels").select("id, name").eq("business_id", business.id).order("sort_order").order("name"),
    supabase.from("staff").select("level_id").eq("business_id", business.id),
  ]);
  const count = (id: string) => (staff ?? []).filter((s) => s.level_id === id).length;

  return (
    <main className="space-y-8">
      <p><Link href="/dashboard/staff" className="text-sm underline">← Staff</Link></p>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Team levels</h1>
        <p>
          Levels are optional. Use them if your prices depend on who does the work, for example a Junior and a Senior stylist.
          Give each person a level on their page, then set a price for each level on the service. A service with no level price
          uses its standard price. If you delete a level, those people go back to the standard price.
        </p>
      </div>

      {levels?.length ? (
        <ul className="divide-y divide-neutral-300 rounded-md border border-neutral-300 dark:divide-neutral-700 dark:border-neutral-700">
          {levels.map((l) => <LevelRow key={l.id} id={l.id} name={l.name} staffCount={count(l.id)} />)}
        </ul>
      ) : <p>You haven&apos;t added any levels.</p>}

      <section aria-labelledby="add-h" className="space-y-3">
        <h2 id="add-h" className="text-xl font-semibold">Add a level</h2>
        <AddLevelForm />
      </section>
    </main>
  );
}
