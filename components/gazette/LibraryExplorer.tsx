"use client";

import { useMemo, useRef, useState } from "react";
import IssueCalendar from "@/components/gazette/IssueCalendar";
import IssueCard, { type IssueWithUrls } from "@/components/gazette/IssueCard";
import { useFlip } from "@/components/gazette/useFlip";

// The archive grid. Unsearched it shows only the two newest rows (how many
// cards that is depends on the columns); the calendar finds any older
// issue by date, and a search looks through all of them.

/** Cards per row at each breakpoint of the grid below: 1, sm 2, lg 3, xl 4. */
const ROWS_SHOWN = 2;
const MAX_COLUMNS = 4;

/** Hides a card past the second row at the widths where it would fall there. */
function rowClass(index: number): string {
  if (index < ROWS_SHOWN * 1) return "flex";
  if (index < ROWS_SHOWN * 2) return "hidden sm:flex";
  if (index < ROWS_SHOWN * 3) return "hidden lg:flex";
  return "hidden xl:flex";
}

const calendarIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
    <path d="M3.5 10h17M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export default function LibraryExplorer({ issues }: { issues: IssueWithUrls[] }) {
  const [query, setQuery] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return issues.filter((i) => {
      if (!q) return true;
      const haystack = [
        `issue ${i.issue_number}`,
        `no. ${i.issue_number}`,
        `№${i.issue_number}`,
        i.title,
        i.summary ?? "",
        i.tags.join(" "),
        i.published_at,
      ]
        .join(" ")
        .toLowerCase();
      return q.split(/\s+/).every((part) => haystack.includes(part));
    });
  }, [issues, query]);

  const searching = query.trim() !== "";
  const shown = searching ? filtered : filtered.slice(0, ROWS_SHOWN * MAX_COLUMNS);

  // As a search narrows or widens, the cards that stay glide into their new
  // places; new cards already rise in on their own (IssueCard).
  const grid = useRef<HTMLDivElement>(null);
  useFlip(grid, `${searching}|${shown.map((i) => i.id).join(",")}`, { enter: false });

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-7">
        <div className="relative grow max-w-md">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-silver"
          >
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="m20 20-3.2-3.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search issues — title, topic, tag, number…"
            className="olg-field !pl-10"
            type="search"
            aria-label="Search issues"
          />
        </div>

        <button type="button" onClick={() => setCalendarOpen(true)} className="olg-btn olg-btn-ghost shrink-0">
          {calendarIcon}
          Find by date
        </button>

        <p className="text-xs text-silver md:ml-auto" aria-live="polite">
          {searching ? `${filtered.length} match${filtered.length === 1 ? "" : "es"}` : `${issues.length} issues · the newest shown`}
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="olg-glass rounded-2xl p-12 text-center text-foreground/65">
          <p className="font-serif text-xl mb-1.5">No issues match that search.</p>
          <p className="text-sm text-silver">Try a different keyword or tag, or find the issue by date.</p>
        </div>
      ) : (
        <div ref={grid} className="grid content-start grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {shown.map((issue, idx) => (
            <div key={issue.id} data-flip={issue.id} className={`${searching ? "flex" : rowClass(idx)} [&>*]:w-full`}>
              <IssueCard issue={issue} index={idx} />
            </div>
          ))}
        </div>
      )}

      {!searching && issues.length > ROWS_SHOWN && (
        <div className="mt-8 flex flex-col items-center gap-2 text-center">
          <button type="button" onClick={() => setCalendarOpen(true)} className="olg-btn olg-btn-primary">
            {calendarIcon}
            Find an older issue in the calendar
          </button>
          <p className="text-xs text-silver">Every issue since the first, by the day it came out.</p>
        </div>
      )}

      {calendarOpen && <IssueCalendar issues={issues} onClose={() => setCalendarOpen(false)} />}
    </div>
  );
}
