"use client";

import { useMemo, useState } from "react";
import { IssueCard } from "@/components/gazette/IssueCard";
import type { IssueWithUrls } from "@/lib/gazette";

export function LibraryExplorer({ issues }: { issues: IssueWithUrls[] }) {
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
        `№ ${i.issue_number}`,
        String(i.issue_number),
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
      <div className="mb-7 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative max-w-md grow">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/40 dark:text-white/40"
          >
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="m20 20-3.2-3.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buraxılış axtarın — başlıq, mövzu, teq, nömrə…"
            className="field !pl-10"
            type="search"
            aria-label="Buraxılışlarda axtarış"
          />
        </div>

        {years.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setYear("all")}
              className={`chip cursor-pointer transition-colors ${year === "all" ? "chip-solid" : "hover:bg-white/80 dark:hover:bg-white/10"}`}
            >
              Bütün illər
            </button>
            {years.map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => setYear(y)}
                className={`chip cursor-pointer transition-colors ${year === y ? "chip-solid" : "hover:bg-white/80 dark:hover:bg-white/10"}`}
              >
                {y}
              </button>
            ))}
          </div>
        )}

        <p className="num text-xs text-ink/45 dark:text-white/45 md:ml-auto" aria-live="polite">
          {filtered.length} buraxılış
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="glass p-12 text-center">
          <p className="mb-1.5 text-xl text-ink dark:text-brand-cream">
            Bu axtarışa uyğun buraxılış yoxdur.
          </p>
          <p className="text-sm text-ink/45 dark:text-white/45">
            Başqa açar söz, teq və ya il seçin.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((issue, idx) => (
            <IssueCard key={issue.id} issue={issue} index={idx} />
          ))}
        </div>
      )}
    </div>
  );
}
