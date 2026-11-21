"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon, buttonClass } from "./icon";

const links: [string, string][] = [["How it works", "#how-it-works"], ["Features", "#features"], ["Pricing", "#pricing"]];

export function HeaderNav() {
  const [menu, setMenu] = useState(false);
  return (
    <>
      <nav aria-label="Main navigation" className="hidden items-center gap-8 md:flex">
        {links.map(([l, h]) => <a key={l} className="py-3 text-sm text-stone-600 hover:text-[#34553e]" href={h}>{l}</a>)}
      </nav>
      <div className="hidden items-center gap-5 md:flex">
        <Link href="/login" className={`${buttonClass} px-1`}>Log in</Link>
        <Link href="/signup" className={`${buttonClass} bg-[#34553e] text-white hover:bg-[#25422e]`}>Get started<Icon name="arrow" className="!h-4 !w-4" /></Link>
      </div>
      <button type="button" aria-label="Toggle navigation" aria-expanded={menu} onClick={() => setMenu(!menu)} className="flex min-h-11 w-11 items-center justify-center rounded-lg focus-visible:ring-2 md:hidden"><Icon name="menu" /></button>
      {menu && (
        <nav aria-label="Mobile navigation" className="absolute left-4 right-4 top-20 flex flex-col rounded-xl border border-stone-200 bg-white p-4 shadow-xl">
          {[...links, ["Log in", "/login"], ["Get started", "/signup"]].map(([l, h]) => (
            <a key={l} href={h} onClick={() => setMenu(false)} className="min-h-11 rounded-lg px-4 py-3 text-sm hover:bg-stone-50">{l}</a>
          ))}
        </nav>
      )}
    </>
  );
}

export function Faq({ items }: { items: [string, string][] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <>
      {items.map(([q, a], i) => (
        <div key={q} className="border-b border-[#dfe4d8]">
          <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)} className="flex min-h-16 w-full items-center justify-between gap-5 py-5 text-left text-sm font-semibold focus-visible:ring-2 focus-visible:ring-emerald-600">
            {q}<span className="text-xl font-normal">{open === i ? "−" : "+"}</span>
          </button>
          {open === i && <p className="pb-6 text-sm leading-7 text-stone-600">{a}</p>}
        </div>
      ))}
    </>
  );
}
