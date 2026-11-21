"use client";

import { useState } from "react";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));
const box = "min-h-11 rounded-md border border-neutral-400 bg-white px-2 py-1 text-base";

/**
 * A 24-hour time picker (00:00 to 23:55) that does not depend on the phone's 12/24-hour setting.
 * Submits one field named `name` with "HH:MM", or empty when no hour is chosen.
 */
export function TimeSelect({ id, name, label, defaultValue = "", invalid, describedBy }: {
  id: string; name: string; label: string; defaultValue?: string; invalid?: boolean; describedBy?: string;
}) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(defaultValue);
  const [hour, setHour] = useState(match ? match[1] : "");
  const [minute, setMinute] = useState(match ? match[2] : "00");
  const minutes = MINUTES.includes(minute) ? MINUTES : [...MINUTES, minute].sort();
  return (
    <span className="inline-flex items-center gap-1">
      <input type="hidden" name={name} value={hour ? `${hour}:${minute}` : ""} />
      <select id={id} aria-label={`${label}: hour`} value={hour} onChange={(e) => setHour(e.target.value)}
        aria-invalid={invalid ? true : undefined} aria-describedby={describedBy} className={box}>
        <option value="">--</option>
        {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
      </select>
      <span aria-hidden="true">:</span>
      <select aria-label={`${label}: minutes`} value={minute} onChange={(e) => setMinute(e.target.value)} disabled={!hour} className={`${box} disabled:opacity-50`}>
        {minutes.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
    </span>
  );
}
