// "Who with?" options on the public booking page.
//
// If everyone who offers the service charges the same price, the customer sees the simple
// "Anyone" option plus the people. If prices differ by level, "Anyone" is replaced by one
// "Any <level>" option per level, so the price is always known before booking.

export type StaffInfo = {
  id: string;
  name: string;
  level_id: string | null;
  level_name: string | null;
  description: string | null;
  price_pence: number;
};

export type Choice = {
  /** Value used in the URL and form: "any", a staff id, "level:<id>" or "level:none". */
  value: string;
  label: string;
  price_pence: number;
  staffIds: string[];
  /** A person's own description (people only). */
  description?: string | null;
};

export type ParsedChoice =
  | { type: "any" }
  | { type: "staff"; id: string }
  | { type: "level"; id: string | null };

export const CHOICE_RE = /^(any|level:none|level:[0-9a-f-]{36}|[0-9a-f-]{36})$/i;

export function parseChoice(value: string): ParsedChoice {
  if (value === "any") return { type: "any" };
  if (value === "level:none") return { type: "level", id: null };
  if (value.startsWith("level:")) return { type: "level", id: value.slice(6) };
  return { type: "staff", id: value };
}

export function pricesVary(staff: StaffInfo[]): boolean {
  return new Set(staff.map((s) => s.price_pence)).size > 1;
}

export function selectStaff(staff: StaffInfo[], choice: ParsedChoice): StaffInfo[] {
  switch (choice.type) {
    case "any": return staff;
    case "staff": return staff.filter((s) => s.id === choice.id);
    case "level": return staff.filter((s) => s.level_id === choice.id);
  }
}

/** The single price for a selection, or null if the people in it charge different prices. */
export function priceFor(staff: StaffInfo[]): number | null {
  if (!staff.length) return null;
  const first = staff[0].price_pence;
  return staff.every((s) => s.price_pence === first) ? first : null;
}

export type Choices = { grouped: boolean; groups: Choice[]; people: Choice[]; defaultValue: string };

export function buildChoices(staff: StaffInfo[]): Choices {
  const people: Choice[] = staff.map((s) => ({
    value: s.id,
    label: s.level_name ? `${s.name} (${s.level_name})` : s.name,
    price_pence: s.price_pence,
    staffIds: [s.id],
    description: s.description,
  }));

  if (!pricesVary(staff)) {
    const groups: Choice[] = staff.length > 1
      ? [{ value: "any", label: "Anyone", price_pence: staff[0]?.price_pence ?? 0, staffIds: staff.map((s) => s.id) }]
      : [];
    return { grouped: false, groups, people, defaultValue: "any" };
  }

  // Prices differ: one group per level (people without a level form "Standard").
  const byLevel = new Map<string | null, StaffInfo[]>();
  for (const s of staff) byLevel.set(s.level_id, [...(byLevel.get(s.level_id) ?? []), s]);
  const groups: Choice[] = [...byLevel.entries()].map(([levelId, members]) => ({
    value: levelId ? `level:${levelId}` : "level:none",
    label: `Any ${members[0].level_name ?? "standard"}`,
    price_pence: Math.min(...members.map((m) => m.price_pence)),
    staffIds: members.map((m) => m.id),
  })).sort((a, b) => a.price_pence - b.price_pence || a.label.localeCompare(b.label));
  return { grouped: true, groups, people, defaultValue: groups[0].value };
}
