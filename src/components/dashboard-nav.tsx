"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONS: Record<string, React.ReactNode> = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4m10-4v4M3 11h18" /></>,
  book: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6m-6 4h6m-6 4h3" /></>,
  spark: <path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5Z" />,
  users: <><circle cx="9" cy="8" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3m1-16a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 6" /></>,
  staff: <><circle cx="12" cy="7" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
  wallet: <><rect x="3" y="5" width="18" height="15" rx="3" /><path d="M3 8h18m-4 5h4m-15-8V3h11" /></>,
  card: <><rect x="2" y="4" width="20" height="16" rx="3" /><path d="M2 10h20m-15 6h4" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="m9 3-1 3-3 1-2 4 2 3v3l4 3 3-1 3 1 4-3v-3l2-3-2-4-3-1-1-3Z" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3m0 3h.01" /></>,
};

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS };

function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg className="h-[18px] w-[18px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

export function DashboardNav({ items, label, variant }: { items: NavItem[]; label: string; variant: "side" | "top" }) {
  const path = usePathname() || "";
  const isActive = (href: string) => (href === "/dashboard" ? path === href : path === href || path.startsWith(`${href}/`));
  const base = "flex min-h-11 items-center gap-3 rounded-lg px-4 text-sm";
  const on = "bg-[color:var(--brand-soft,#e9efdc)] font-semibold text-[color:var(--brand-text,#3c6132)]";
  const off = "text-[#64705e] hover:bg-[color:var(--brand-soft,#f0f3e9)]";
  return (
    <nav aria-label={label} className={variant === "side" ? "flex-1 space-y-1 overflow-y-auto px-3" : "flex gap-1 overflow-x-auto border-b border-[#e1e7d7] bg-white px-4 py-2 lg:hidden"}>
      {items.map((i) => (
        <Link key={i.href} href={i.href} aria-current={isActive(i.href) ? "page" : undefined}
          className={`${base} ${variant === "top" ? "shrink-0 px-3" : "w-full"} ${isActive(i.href) ? on : off}`}>
          <Icon name={i.icon} />{i.label}
        </Link>
      ))}
    </nav>
  );
}
