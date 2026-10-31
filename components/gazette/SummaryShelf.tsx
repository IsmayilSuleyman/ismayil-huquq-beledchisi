"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import SummaryDownloadButton from "@/components/gazette/SummaryDownloadButton";
import { formatDate } from "@/lib/gazette/format";
import { plainText } from "@/lib/gazette/marks";
import { kindLabel } from "@/lib/gazette/summaries";
import { SUMMARY_TAGS, TAG_LABEL, isSummaryTag } from "@/lib/gazette/summary-tags";
import type { CourtSummaryWithUrls } from "@/lib/gazette/types";

type Sort = "newest" | "oldest";

function SummaryCard({ summary, index }: { summary: CourtSummaryWithUrls; index: number }) {
  const bullets = summary.body.reduce((n, b) => n + b.bullets.length, 0);
  return (
    <article
      className="group relative olg-glass olg-glass-hover rounded-2xl p-5 sm:p-6 flex flex-col gap-3 olg-rise"
      style={{ animationDelay: `${Math.min(index, 11) * 55}ms` }}
    >
      <Link href={`/summaries/${summary.decision_id}`} className="absolute inset-0 z-[5]" aria-label={`Read the summary: ${summary.topic}`} />
      <div className="flex items-center gap-2.5 flex-wrap text-xs text-silver">
        <span className={`olg-chip !py-0.5 ${summary.kind === "qərar" ? "!bg-omni/60 !border-azure/45 !text-white" : ""}`} lang="az">
          {kindLabel(summary.kind)}
        </span>
        <span>{formatDate(summary.decision_date)}</span>
        <span className="ml-auto">No. {summary.decision_id}</span>
      </div>
      <h3 className="font-serif text-[1.2rem] leading-snug text-foreground">{summary.topic}</h3>
      <p className="text-sm text-foreground/60 line-clamp-2" lang="az">
        {summary.title}
      </p>
      {summary.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {summary.tags.map((t) => (
            <span key={t} className="olg-chip !py-0.5 !px-2 !text-[0.66rem]">
              {isSummaryTag(t) ? TAG_LABEL[t] : t}
            </span>
          ))}
        </div>
      )}
      <div className="mt-auto pt-2 flex items-center justify-between gap-2 text-xs text-silver">
        <span className="truncate">
          {bullets} position{bullets === 1 ? "" : "s"} · {summary.ai_generated ? "AI-generated" : `by ${summary.author}`}
        </span>
        <span className="relative z-10">
          <SummaryDownloadButton summary={summary} variant="icon" />
        </span>
      </div>
    </article>
  );
}

export default function SummaryShelf({ summaries }: { summaries: CourtSummaryWithUrls[] }) {
  const [query, setQuery] = useState("");
  const [year, setYear] = useState<string | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("newest");

  const years = useMemo(
    () => [...new Set(summaries.map((s) => s.decision_date.slice(0, 4)))].sort((a, b) => b.localeCompare(a)),
    [summaries],
  );
  // Only the tags in use, in the vocabulary's order.
  const tags = useMemo(() => SUMMARY_TAGS.filter((t) => summaries.some((s) => s.tags.includes(t))), [summaries]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const byDate = (a: CourtSummaryWithUrls, b: CourtSummaryWithUrls) =>
      a.decision_date === b.decision_date ? b.decision_id - a.decision_id : b.decision_date.localeCompare(a.decision_date);
    const list = summaries.filter((s) => {
      if (year && !s.decision_date.startsWith(year)) return false;
      if (tag && !s.tags.includes(tag)) return false;
      if (!q) return true;
      const haystack = [
        s.topic,
        s.title,
        String(s.decision_id),
        s.decision_date,
        ...s.body.flatMap((b) => [b.heading ?? "", ...b.bullets.flatMap((x) => [plainText(x.text), ...(x.sub ?? []).map(plainText)])]),
      ]
        .join(" ")
        .toLowerCase();
      return q.split(/\s+/).every((part) => haystack.includes(part));
    });
    list.sort(sort === "newest" ? byDate : (a, b) => byDate(b, a));
    return list;
  }, [summaries, query, year, tag, sort]);

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
            placeholder="Search summaries — topic, article, a word of the decision…"
            className="olg-field !pl-10"
            type="search"
            aria-label="Search summaries"
          />
        </div>

        {years.length > 1 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {[null, ...years].map((y) => (
              <button
                key={y ?? "all"}
                onClick={() => setYear(y)}
                className={`olg-chip transition-colors cursor-pointer ${
                  year === y ? "!bg-omni/70 !border-azure/50 !text-white" : "hover:bg-veil/10"
                }`}
              >
                {y ?? "All years"}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 md:ml-auto">
          <button
            type="button"
            onClick={() => setSort((s) => (s === "newest" ? "oldest" : "newest"))}
            className="olg-chip transition-colors cursor-pointer hover:bg-veil/10"
            title="Sort by the decision's date"
            aria-label={`Sorted ${sort} first; switch to ${sort === "newest" ? "oldest" : "newest"} first`}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d={sort === "newest" ? "M12 5v14m0 0 5-5m-5 5-5-5" : "M12 19V5m0 0 5 5m-5-5-5 5"} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {sort === "newest" ? "Newest first" : "Oldest first"}
          </button>
          <p className="text-xs text-silver" aria-live="polite">
            {filtered.length} summar{filtered.length === 1 ? "y" : "ies"}
          </p>
        </div>
      </div>

      {tags.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap mb-7 -mt-3">
          <span className="text-[0.7rem] tracking-[0.18em] uppercase text-silver mr-1">Area</span>
          {[null, ...tags].map((t) => (
            <button
              key={t ?? "all"}
              onClick={() => setTag(t)}
              className={`olg-chip transition-colors cursor-pointer ${
                tag === t ? "!bg-omni/70 !border-azure/50 !text-white" : "hover:bg-veil/10"
              }`}
            >
              {t ? TAG_LABEL[t] : "All areas"}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="olg-glass rounded-2xl p-12 text-center text-foreground/65">
          <p className="font-serif text-xl mb-1.5">No summary matches that search.</p>
          <p className="text-sm text-silver">Try a different keyword, area or year.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((summary, idx) => (
            <SummaryCard key={summary.id} summary={summary} index={idx} />
          ))}
        </div>
      )}
    </div>
  );
}
