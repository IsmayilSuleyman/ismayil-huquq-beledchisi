"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatDate } from "@/lib/gazette/format";
import type { Issue } from "@/lib/gazette/types";

// The library's calendar: a month at a time, every day that has an issue
// marked and linked to it, and the month's issues listed under the grid.
// It opens on the latest issue's month.

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

type Month = { y: number; m: number };

const monthOf = (iso: string): Month => ({ y: Number(iso.slice(0, 4)), m: Number(iso.slice(5, 7)) - 1 });
const monthIndex = ({ y, m }: Month) => y * 12 + m;
const dayKey = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export default function IssueCalendar({ issues, onClose }: { issues: Issue[]; onClose: () => void }) {
  const dialog = useRef<HTMLDivElement>(null);
  const dates = useMemo(() => issues.map((i) => i.published_at.slice(0, 10)).sort(), [issues]);
  const first = monthOf(dates[0]);
  const last = monthOf(dates[dates.length - 1]);
  const [month, setMonth] = useState<Month>(last);

  const byDay = useMemo(() => {
    const map = new Map<string, Issue[]>();
    for (const issue of issues) {
      const key = issue.published_at.slice(0, 10);
      map.set(key, [...(map.get(key) ?? []), issue]);
    }
    return map;
  }, [issues]);

  const years = useMemo(() => [...new Set(dates.map((d) => Number(d.slice(0, 4))))], [dates]);

  useEffect(() => {
    dialog.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const { y, m } = month;
  const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const lead = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7; // Monday first
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const monthIssues = issues
    .filter((i) => i.published_at.startsWith(`${y}-${String(m + 1).padStart(2, "0")}`))
    .sort((a, b) => a.published_at.localeCompare(b.published_at));

  const canPrev = monthIndex(month) > monthIndex(first);
  const canNext = monthIndex(month) < monthIndex(last);
  const step = (by: number) => {
    const i = monthIndex(month) + by;
    setMonth({ y: Math.floor(i / 12), m: i % 12 });
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="presentation">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-[#05080f]/70 backdrop-blur-sm cursor-default" />
      <div
        ref={dialog}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="calendar-title"
        className="olg-sheet olg-glass-deep relative w-full max-w-sm max-h-[90vh] overflow-y-auto overscroll-contain rounded-3xl p-5 sm:p-6 outline-none"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="olg-eyebrow">Find an issue</p>
          <button type="button" onClick={onClose} aria-label="Close" title="Close (Esc)" className="olg-btn olg-btn-ghost !px-2.5 !py-2">
            ✕
          </button>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <button type="button" onClick={() => step(-1)} disabled={!canPrev} aria-label="Previous month" className="olg-btn olg-btn-ghost !px-2.5 !py-2">
            ←
          </button>
          <h3 id="calendar-title" className="font-serif text-xl" aria-live="polite">
            {MONTHS[m]} {y}
          </h3>
          <button type="button" onClick={() => step(1)} disabled={!canNext} aria-label="Next month" className="olg-btn olg-btn-ghost !px-2.5 !py-2">
            →
          </button>
        </div>

        {years.length > 1 && (
          <div className="mt-3 flex justify-center gap-1.5 flex-wrap">
            {years.map((year) => (
              <button
                key={year}
                type="button"
                onClick={() => setMonth(year === last.y ? last : year === first.y ? first : { y: year, m: 0 })}
                aria-pressed={year === y}
                className={`olg-chip cursor-pointer transition-colors ${year === y ? "!bg-omni/70 !border-azure/50 !text-white" : "hover:bg-white/10"}`}
              >
                {year}
              </button>
            ))}
          </div>
        )}

        <div className="mt-4 grid grid-cols-7 gap-1 text-center" role="grid" aria-label={`${MONTHS[m]} ${y}`}>
          {WEEKDAYS.map((d) => (
            <span key={d} className="text-[0.62rem] tracking-[0.14em] uppercase text-silver py-1">
              {d}
            </span>
          ))}
          {cells.map((d, i) => {
            if (d === null) return <span key={`pad-${i}`} />;
            const hits = byDay.get(dayKey(y, m, d));
            if (!hits) {
              return (
                <span key={d} className="aspect-square grid place-items-center text-sm text-foreground/35">
                  {d}
                </span>
              );
            }
            return (
              <Link
                key={d}
                href={`/issues/${hits[0].issue_number}`}
                title={hits.map((h) => `No. ${h.issue_number}: ${h.title}`).join("\n")}
                aria-label={`${d} ${MONTHS[m]}: issue No. ${hits[0].issue_number}`}
                className="aspect-square grid place-items-center rounded-xl text-sm font-medium text-white bg-omni/70 border border-azure/45 hover:bg-omni-bright transition-colors relative"
              >
                {d}
                <span className="absolute bottom-1 text-[0.55rem] leading-none text-azure-soft">№{hits[0].issue_number}</span>
              </Link>
            );
          })}
        </div>

        <div className="mt-5 border-t olg-hairline pt-4">
          {monthIssues.length === 0 ? (
            <p className="text-sm text-silver text-center">No issue this month.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {monthIssues.map((issue) => (
                <li key={issue.id}>
                  <Link
                    href={`/issues/${issue.issue_number}`}
                    className="flex items-baseline gap-3 rounded-xl px-3 py-2 hover:bg-white/[0.06] transition-colors"
                  >
                    <span className="text-xs text-azure-soft tabular-nums shrink-0">No. {issue.issue_number}</span>
                    <span className="text-sm text-foreground/85 truncate grow">{issue.title}</span>
                    <span className="text-[0.68rem] text-silver shrink-0">{formatDate(issue.published_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
