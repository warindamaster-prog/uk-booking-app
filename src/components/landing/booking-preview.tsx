"use client";

import { useState } from "react";
import { Icon, buttonClass } from "./icon";

export function BookingPreview() {
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(11);
  const [day, setDay] = useState(14);
  const [time, setTime] = useState("10:30");
  const [confirmed, setConfirmed] = useState(false);
  const monthLabel = new Date(year, month, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const days = new Date(year, month + 1, 0).getDate();
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;

  function go(step: number) {
    const d = new Date(year, month + step, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
    setDay(1);
    setConfirmed(false);
  }

  return (
    <div className="relative mx-auto w-full max-w-[510px] pb-10 lg:ml-auto">
      <div className="absolute -right-8 -top-7 h-32 w-32 rounded-full border border-[#cbd5c0]" />
      <div className="absolute -bottom-1 -left-10 h-52 w-52 rounded-full border border-[#cbd5c0]" />
      <div className="relative rounded-2xl border border-white bg-white p-6 shadow-[0_24px_70px_-30px_#34453655] sm:p-7">
        <div className="mb-6 flex items-center gap-2 border-b border-stone-100 pb-5 text-xs text-stone-600">
          <span className="h-2 w-2 rounded-full bg-[#c8dbbf]" /><span className="h-2 w-2 rounded-full bg-[#e2e7dc]" /><span className="mr-4 h-2 w-2 rounded-full bg-[#e2e7dc]" />
          <span className="flex-1 text-center">yourbusiness.book.app</span><Icon name="link" className="!h-3.5 !w-3.5" />
        </div>
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#eaf0e5] font-serif text-2xl italic text-[#36513c]">s.</div>
          <div><p className="font-semibold tracking-tight">Studio &amp; Co.</p><p className="mt-0.5 text-xs text-stone-600">A little time, just for you.</p></div>
          <span className="ml-auto rounded-full bg-[#f2f5ed] px-2.5 py-1 text-xs text-[#456343]">Demo</span>
        </div>
        <h3 className="text-xl font-semibold tracking-tight">Book your next appointment</h3>
        <p className="mt-1.5 text-sm text-stone-600">Pick a time that works for you.</p>
        <div className="mt-5 flex items-center justify-between rounded-lg border border-[#e5e8e0] bg-[#fafbf8] p-3">
          <div className="flex items-center gap-3"><div className="rounded-lg bg-white p-2 text-[#537151]"><Icon name="clock" /></div><div><p className="text-sm font-semibold">Discovery consultation</p><p className="mt-1 text-xs text-stone-600">30 minutes · Online meeting</p></div></div>
          <span className="text-sm font-semibold">Free</span>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm font-semibold">{monthLabel}</p>
          <div className="flex">
            <button type="button" aria-label="Previous month" className="flex min-h-11 w-11 items-center justify-center rounded-lg hover:bg-stone-100 focus-visible:ring-2" onClick={() => go(-1)}><Icon name="chevron" className="!h-4 !w-4 rotate-180" /></button>
            <button type="button" aria-label="Next month" className="flex min-h-11 w-11 items-center justify-center rounded-lg hover:bg-stone-100 focus-visible:ring-2" onClick={() => go(1)}><Icon name="chevron" className="!h-4 !w-4" /></button>
          </div>
        </div>
        <div className="grid grid-cols-7 text-center">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={i} className="py-2 text-xs text-stone-600">{d}</span>)}
          {Array.from({ length: offset }, (_, i) => <span key={`b${i}`} />)}
          {Array.from({ length: days }, (_, i) => i + 1).map((d) => (
            <button type="button" key={d} aria-label={`${d} ${monthLabel}`} aria-pressed={day === d} onClick={() => { setDay(d); setConfirmed(false); }}
              className={`mx-auto flex min-h-11 w-full max-w-11 items-center justify-center rounded-lg text-sm transition focus-visible:ring-2 focus-visible:ring-emerald-600 ${day === d ? "bg-[#34553e] font-semibold text-white shadow-md" : "text-stone-700 hover:bg-[#edf2e8]"}`}>{d}</button>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {["09:00", "10:30", "14:00"].map((t) => (
            <button type="button" key={t} aria-pressed={time === t} onClick={() => { setTime(t); setConfirmed(false); }}
              className={`min-h-11 rounded-lg border text-sm font-medium focus-visible:ring-2 focus-visible:ring-emerald-600 ${time === t ? "border-[#496746] bg-[#eef3e9] text-[#34553e]" : "border-stone-200 text-stone-600 hover:bg-stone-50"}`}>{t}</button>
          ))}
        </div>
        <button type="button" onClick={() => setConfirmed(true)} className={`${buttonClass} mt-4 w-full bg-[#34553e] text-white hover:bg-[#25422e]`}>
          {confirmed ? "Demo appointment selected" : "Confirm appointment"}<Icon name={confirmed ? "check" : "arrow"} className="!h-4 !w-4" />
        </button>
        <p aria-live="polite" className="mt-3 text-center text-xs text-stone-600">
          {confirmed ? `${day} ${monthLabel} at ${time} · Preview only, no booking made.` : "Europe/London time · A preview of your booking page"}
        </p>
      </div>
      <div className="absolute -bottom-1 right-0 flex items-center gap-3 rounded-xl border border-[#e6e9e0] bg-white px-5 py-4 shadow-[0_8px_30px_-12px_#34453640] sm:-right-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#edf4e7] text-[#456443]"><Icon name="check" /></div>
        <div><p className="text-sm font-semibold">More bookings. Less busywork.</p><p className="mt-1 text-xs text-stone-600">That’s a better way to work.</p></div>
      </div>
    </div>
  );
}
