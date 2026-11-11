"use client";

import { useEffect, useState } from "react";
import { ArticleBody, ArticleDiff, ArticleNumber } from "@/components/versions/LawText";
import { useVersions } from "@/components/versions/VersionsProvider";
import { shortDate } from "@/lib/versions/act";
import type { ArticleHistory } from "@/lib/versions/types";

/** What the frame says about the act a wording comes from. */
export type WordingSource = { label: string; actTitle?: string; eqanunId?: number; decision?: string };

const STEP_MS = 2600;

/**
 * An article with earlier wordings, framed on hover (İsmayıl's design):
 * arrows step through the wordings, the top right says when the shown one
 * was in force, C shows what the amendment changed as track changes, ▶
 * plays the wordings from the first to the one in force, and the foot names
 * the act that made the shown wording. W (a Word file) waits for the
 * template.
 */
export default function ArticleFrame({ history, sources }: { history: ArticleHistory; sources: Record<string, WordingSource> }) {
  const { asOf } = useVersions();
  const versions = history.versions;
  const last = versions.length - 1;
  // The wording the page-wide date asks for; an arrow click overrides it until the date changes.
  const forDate = asOf === null ? last : versions.reduce((found, v, i) => (v.from <= asOf ? i : found), -1);
  const [pick, setPick] = useState<{ asOf: string | null; index: number } | null>(null);
  const [compare, setCompare] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [step, setStep] = useState<number | null>(null);

  useEffect(() => {
    if (step === null) return;
    const timer = setTimeout(() => {
      if (step >= last) {
        setStep(null);
        setPick({ asOf, index: last });
      } else setStep(step + 1);
    }, step === 0 ? 1200 : STEP_MS);
    return () => clearTimeout(timer);
  }, [step, last, asOf]);

  const index = step ?? (pick && pick.asOf === asOf ? pick.index : forDate);
  const id = `m-${history.number}`;

  if (index < 0) {
    // The article did not exist on the chosen date.
    const first = versions[0];
    return (
      <section id={id} className="olg-law-article olg-law-muted text-sm">
        Maddə <ArticleNumber number={history.number} />. {first.title} — {shortDate(first.from)} tarixindən ({sources[first.act]?.label}).
      </section>
    );
  }

  const shown = versions[index];
  const showDiff = step !== null ? step > 0 : compare && index > 0;
  const source = sources[shown.act];
  const go = (to: number) => {
    setStep(null);
    setPinned(true);
    setPick({ asOf, index: Math.max(0, Math.min(last, to)) });
  };
  const when = shown.to ? `${shortDate(shown.from)} – ${shortDate(shown.to)}` : `${shortDate(shown.from)}-dən qüvvədədir`;

  return (
    <section
      id={id}
      className={`olg-law-article olg-law-amended${step !== null ? " olg-law-play" : ""}`}
      data-open={pinned || compare || step !== null || index !== last}
      aria-label={`Maddə ${history.number}: ${versions.length} redaksiya`}
    >
      <div className="olg-law-chrome">
        <div className="olg-law-tools">
          <button
            type="button"
            className="olg-law-tool"
            aria-pressed={compare}
            disabled={index === 0 && step === null}
            title={index === 0 ? "İlk redaksiya: müqayisə ediləcək əvvəlki mətn yoxdur" : "Əvvəlki redaksiya ilə müqayisə"}
            onClick={() => {
              setStep(null);
              setPinned(true);
              setCompare(!compare);
            }}
          >
            C
          </button>
          <button type="button" className="olg-law-tool" disabled title="Word faylı: şablon hazır olanda">
            W
          </button>
          <button
            type="button"
            className="olg-law-tool"
            aria-pressed={step !== null}
            title={step !== null ? "Dayandır" : "Dəyişiklikləri ardıcıl göstər"}
            onClick={() => {
              setPinned(true);
              setCompare(false);
              setStep(step !== null ? null : 0);
            }}
          >
            {step !== null ? "■" : "▶"}
          </button>
        </div>
        <div className="olg-law-nav">
          <button type="button" className="olg-law-arrow prev" disabled={index === 0} onClick={() => go(index - 1)} aria-label="Əvvəlki redaksiya">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden>
              <path d="M16 4 6 12l10 8-3-8 3-8Z" />
            </svg>
          </button>
          <button type="button" className="olg-law-arrow next" disabled={index === last} onClick={() => go(index + 1)} aria-label="Sonrakı redaksiya">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden>
              <path d="M8 4l10 8-10 8 3-8-3-8Z" />
            </svg>
          </button>
          <span className="olg-law-when" aria-live="polite">
            {when}
            <span className="olg-law-pager"> · {index + 1}/{versions.length}</span>
          </span>
        </div>
      </div>

      <div key={step ?? "still"}>
        {showDiff ? (
          <ArticleDiff number={history.number} before={versions[index - 1]} after={shown} />
        ) : (
          <ArticleBody number={history.number} title={shown.title} paragraphs={shown.paragraphs} />
        )}
      </div>

      <div className="olg-law-chrome olg-law-by">
        <span>
          Qəbul edilib: {source?.label}
          {source?.actTitle ? (
            <span className="olg-law-acttitle">
              {" — "}
              {source.eqanunId ? (
                <a href={`https://e-qanun.az/framework/${source.eqanunId}`} target="_blank" rel="noopener noreferrer">
                  {source.actTitle}
                </a>
              ) : (
                source.actTitle
              )}
            </span>
          ) : null}
        </span>
        {shown.changes?.length ? (
          <details>
            <summary>Nə dəyişib</summary>
            {shown.changes.map((c, i) => (
              <p key={i} className="mt-1 text-[0.82rem] leading-snug">
                {c}.
              </p>
            ))}
            {source?.decision ? <p className="mt-1 text-[0.75rem] text-silver">{source.decision}.</p> : null}
          </details>
        ) : null}
      </div>
    </section>
  );
}
