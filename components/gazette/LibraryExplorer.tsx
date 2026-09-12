"use client";

import { useMemo, useState } from "react";
import IssueCard, { type IssueWithUrls } from "@/components/gazette/IssueCard";

export default function LibraryExplorer({ issues }: { issues: IssueWithUrls[] }) {
  const [query, setQuery] = useState("");
  const [year, setYear] = useState<"all" | number>("all");

  const years = useMemo(() => {
    const set = new Set(issues.map((i) => Number(i.published_at.slice(0, 4))));
    return [...set].sort((a, b) => b - a);
  }, [issues]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return issues.filter((i) => {
      if (year !== "all" && Number(i.published_at.slice(0, 4)) !== year) return false;
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
  }, [issues, query, year]);

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

        {years.length > 1 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setYear("all")}
              className={`olg-chip transition-colors cursor-pointer ${
                year === "all" ? "!bg-omni/70 !border-azure/50 !text-white" : "hover:bg-white/10"
              }`}
            >
              All years
            </button>
            {years.map((y) => (
              <button
                key={y}
                onClick={() => setYear(y)}
                className={`olg-chip transition-colors cursor-pointer ${
                  year === y ? "!bg-omni/70 !border-azure/50 !text-white" : "hover:bg-white/10"
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        )}

        <p className="text-xs text-silver md:ml-auto" aria-live="polite">
          {filtered.length} issue{filtered.length === 1 ? "" : "s"}
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="olg-glass rounded-2xl p-12 text-center text-foreground/65">
          <p className="font-serif text-xl mb-1.5">No issues match that search.</p>
          <p className="text-sm text-silver">Try a different keyword, tag or year.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map((issue, idx) => (
            <IssueCard key={issue.id} issue={issue} index={idx} />
          ))}
        </div>
      )}
    </div>
  );
}
