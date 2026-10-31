"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ACT_SECTIONS,
  actLabel,
  averageStars,
  BOARD_LIMIT,
  pickBoard,
  pickSuggested,
  RATING_MIN_AVERAGE,
  RATING_MIN_VOTES,
  ratedOff,
  SECTION_LABEL,
  SECTION_SHORT,
  sourceHost,
  TOPIC_LABEL,
  type ActSection,
  type GazetteAct,
  type Rating,
} from "@/lib/gazette/acts";
import { formatDate } from "@/lib/gazette/format";
import { getBrowserSupabase } from "@/lib/gazette/supabase";

// The board on the landing page: the last month's acts as notes, up to
// twelve picks (lib/gazette/acts.ts decides: important by rule, best rated
// by readers, not voted off), every one a button that opens the act in a
// side panel with its source, its issue and a five-star vote on how much
// it matters. A note's link (#act=<id>) opens the same panel on arrival,
// so a lawyer can send a colleague one act. The + note at the end lets a
// reader suggest one act the picks left out; the most suggested ones join
// the board beside the picks (suggest_act, migration 20261031180000).

const HASH_KEY = "act";
const VOTER_KEY = "olg-voter";
const VOTE_KEY = (id: string) => `olg-rating:${id}`;
const SUGGESTION_KEY = "olg-suggestion";

type Filter = "all" | ActSection;

function readHash(): string | null {
  if (typeof window === "undefined") return null;
  const match = /^#act=([0-9a-f-]+)$/i.exec(window.location.hash);
  return match ? match[1] : null;
}

function writeHash(id: string | null) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.hash = id ? `${HASH_KEY}=${id}` : "";
  window.history.replaceState(window.history.state, "", url.toString());
}

/** Reads a stored value; storage can be blocked (private mode), in which case there is none. */
function stored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function store(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Nothing to do: the vote still counts on the server, only the browser forgets it.
  }
}

let voterInMemory: string | null = null;

/** The browser's reader token, made once and kept; without storage it lasts the page view. */
function voterToken(): string {
  const saved = stored(VOTER_KEY);
  if (saved && saved.length >= 16) return saved;
  if (!voterInMemory) {
    voterInMemory =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
    store(VOTER_KEY, voterInMemory);
  }
  return voterInMemory;
}

export default function UpdatesBoard({ acts, days }: { acts: GazetteAct[]; days: number }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [showAll, setShowAll] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  // Votes made in this page view, on top of what the server rendered.
  const [ratings, setRatings] = useState<Record<string, Rating>>({});
  // Suggestion counts changed in this page view, and this reader's own suggestion.
  const [suggestions, setSuggestions] = useState<Record<string, number>>({});
  const [mySuggestion, setMySuggestion] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const lastNote = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const saved = stored(SUGGESTION_KEY);
    if (saved && acts.some((a) => a.id === saved)) setMySuggestion(saved);
  }, [acts]);

  const current = useMemo(
    () =>
      acts.map((a) => {
        const rated = ratings[a.id] ? { ...a, ...ratings[a.id] } : a;
        return a.id in suggestions ? { ...rated, suggestion_count: suggestions[a.id] } : rated;
      }),
    [acts, ratings, suggestions],
  );
  const picks = useMemo(() => pickBoard(current), [current]);
  const pickIds = useMemo(() => new Set(picks.map((a) => a.id)), [picks]);
  const suggested = useMemo(() => pickSuggested(current, picks), [current, picks]);
  const suggestedIds = useMemo(() => new Set(suggested.map((a) => a.id)), [suggested]);
  const board = useMemo(() => [...picks, ...suggested], [picks, suggested]);
  // What a reader may suggest: every act of the window not on the board, plus their own suggestion.
  const candidates = useMemo(
    () => current.filter((a) => a.id === mySuggestion || (!pickIds.has(a.id) && !suggestedIds.has(a.id))),
    [current, pickIds, suggestedIds, mySuggestion],
  );

  const pool = showAll ? current : board;
  const shown = useMemo(() => (filter === "all" ? pool : pool.filter((a) => a.section === filter)), [pool, filter]);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: pool.length, decrees: 0, decisions: 0, bills: 0, court: 0 };
    for (const a of pool) c[a.section]++;
    return c;
  }, [pool]);

  // A link to one act opens it straight away, whatever the filters.
  useEffect(() => {
    const id = readHash();
    if (id && acts.some((a) => a.id === id)) {
      if (!pickIds.has(id)) setShowAll(true);
      setOpenId(id);
    }
    // Only on arrival: later votes must not re-open or re-filter anything.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const open = useCallback((id: string, from?: HTMLElement | null) => {
    if (from) lastNote.current = from;
    setOpenId(id);
    writeHash(id);
  }, []);

  const close = useCallback(() => {
    setOpenId(null);
    writeHash(null);
    lastNote.current?.focus();
  }, []);

  const rate = useCallback(async (id: string, stars: number) => {
    const { data, error } = await getBrowserSupabase().rpc("rate_act", { p_act: id, p_voter: voterToken(), p_stars: stars });
    if (error) throw new Error(error.message);
    const row = (Array.isArray(data) ? data[0] : data) as Rating | undefined;
    if (!row) throw new Error("No totals came back");
    setRatings((r) => ({ ...r, [id]: { rating_count: row.rating_count, rating_sum: row.rating_sum } }));
    store(VOTE_KEY(id), String(stars));
  }, []);

  /** Sets this reader's one suggestion, or withdraws it with null. */
  const suggest = useCallback(async (id: string | null) => {
    const { data, error } = await getBrowserSupabase().rpc("suggest_act", { p_act: id, p_voter: voterToken() });
    if (error) throw new Error(error.message);
    const rows = (Array.isArray(data) ? data : [data]) as { id: string; suggestion_count: number }[];
    setSuggestions((s) => ({ ...s, ...Object.fromEntries(rows.filter(Boolean).map((row) => [row.id, row.suggestion_count])) }));
    setMySuggestion(id);
    store(SUGGESTION_KEY, id ?? "");
  }, []);

  const openIndex = openId ? shown.findIndex((a) => a.id === openId) : -1;
  const openAct = openIndex >= 0 ? shown[openIndex] : (current.find((a) => a.id === openId) ?? null);
  const prev = openIndex > 0 ? shown[openIndex - 1] : null;
  const next = openIndex >= 0 && openIndex < shown.length - 1 ? shown[openIndex + 1] : null;

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
        <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Filter the board by type of act">
          {(["all", ...ACT_SECTIONS] as Filter[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
              className={`olg-chip transition-colors cursor-pointer ${
                filter === key ? "!bg-omni/70 !border-azure/50 !text-white" : "hover:bg-white/10"
              }`}
            >
              {key === "all" ? "Everything" : SECTION_SHORT[key]}
              <span className="opacity-60 tabular-nums">{counts[key]}</span>
            </button>
          ))}
        </div>
        {acts.length > board.length && (
          <label className="inline-flex items-center gap-2 text-xs text-silver cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
              className="accent-[#2e62c9] w-3.5 h-3.5"
            />
            Show every act of the last {days} days ({acts.length})
          </label>
        )}
      </div>

      <div className="olg-board">
        {shown.length === 0 && candidates.length === 0 ? (
          <p className="relative text-center text-sm text-silver py-10">Nothing on the board for this filter.</p>
        ) : (
          <ul className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {shown.map((act) => {
              const average = averageStars(act);
              return (
                <li key={act.id} className="flex">
                  <button
                    type="button"
                    onClick={(e) => open(act.id, e.currentTarget)}
                    aria-haspopup="dialog"
                    aria-expanded={openId === act.id}
                    className={`olg-note olg-note-${act.section} ${pickIds.has(act.id) || suggestedIds.has(act.id) ? "" : "olg-note-dim"}`}
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="olg-note-label">{actLabel(act)}</span>
                      <span className="olg-note-date">{shortDate(act.date)}</span>
                    </span>
                    <span className="olg-note-body mt-2.5 grow" lang="az">
                      {act.text}
                    </span>
                    <span className="mt-3 flex items-end justify-between gap-2">
                      <span className="flex flex-wrap gap-1">
                        {suggestedIds.has(act.id) && (
                          <span
                            className="olg-note-suggested"
                            title={`${act.suggestion_count} reader${act.suggestion_count === 1 ? "" : "s"} suggested it`}
                          >
                            {act.id === mySuggestion ? "Your pick" : "Suggested"}
                            {act.suggestion_count > 1 ? ` · ${act.suggestion_count}` : ""}
                          </span>
                        )}
                        {act.topics.slice(0, suggestedIds.has(act.id) ? 1 : 2).map((t) => (
                          <span key={t} className="olg-note-tag">
                            {TOPIC_LABEL[t]}
                          </span>
                        ))}
                      </span>
                      <span className="flex items-center gap-2.5 whitespace-nowrap">
                        {average !== null && (
                          <span
                            className="olg-note-stars"
                            title={`${act.rating_count} reader${act.rating_count === 1 ? "" : "s"} rated it`}
                          >
                            ★ {average.toFixed(1)}
                          </span>
                        )}
                        <span className="olg-note-read">Read →</span>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
            {candidates.length > 0 && (
              <li className="flex">
                <button
                  type="button"
                  onClick={(e) => {
                    lastNote.current = e.currentTarget;
                    setSuggesting(true);
                  }}
                  aria-haspopup="dialog"
                  aria-expanded={suggesting}
                  className="olg-note olg-note-add"
                >
                  <span className="olg-note-plus" aria-hidden>
                    +
                  </span>
                  <span className="text-sm text-foreground/85">Suggest a note</span>
                  <span className="text-xs leading-relaxed max-w-[15rem]">
                    {mySuggestion
                      ? "You have suggested an act. Tap to change it."
                      : "Pin one important act the picks missed."}
                  </span>
                </button>
              </li>
            )}
          </ul>
        )}
      </div>

      {openAct && (
        <ActPanel
          act={openAct}
          picked={pickIds.has(openAct.id)}
          suggested={suggestedIds.has(openAct.id)}
          onClose={close}
          onPrev={prev ? () => open(prev.id) : null}
          onNext={next ? () => open(next.id) : null}
          onRate={rate}
        />
      )}

      {suggesting && (
        <SuggestPanel
          candidates={candidates}
          mine={mySuggestion}
          days={days}
          onSuggest={suggest}
          onOpen={(id) => {
            setSuggesting(false);
            open(id);
          }}
          onClose={() => {
            setSuggesting(false);
            lastNote.current?.focus();
          }}
        />
      )}
    </div>
  );
}

const shortFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
function shortDate(iso: string): string {
  return shortFmt.format(new Date(`${iso}T00:00:00`));
}

/** Why a note is not among the picks, for the panel's footnote. */
function offBoardReason(act: GazetteAct, picked: boolean, suggested: boolean): string | null {
  if (picked) return null;
  if (suggested) {
    return `Readers put this act on the board: ${act.suggestion_count} suggested it with the + note.`;
  }
  if (!act.important) return "This act is off the board by default: it falls outside the desk’s key areas.";
  if (ratedOff(act)) {
    return `Readers took this act off the board: ${act.rating_count} rated it, averaging under ${RATING_MIN_AVERAGE} stars.`;
  }
  return `This act is eligible but not among the ${BOARD_LIMIT} picks right now; a higher rating moves it up.`;
}

function ActPanel({
  act,
  picked,
  suggested,
  onClose,
  onPrev,
  onNext,
  onRate,
}: {
  act: GazetteAct;
  picked: boolean;
  suggested: boolean;
  onClose: () => void;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
  onRate: (id: string, stars: number) => Promise<void>;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // No body scroll lock: on phones that jumps the page and paints it
    // white behind the sheet. The backdrop covers the page instead, and the
    // sheet keeps its own scrolling to itself (overscroll-contain).
    panel.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && onPrev) onPrev();
      else if (e.key === "ArrowRight" && onNext) onNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onPrev, onNext]);

  useEffect(() => {
    setCopied(false);
    panel.current?.scrollTo({ top: 0 });
  }, [act.id]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      // No clipboard (an old browser, or an insecure page): the address bar still has the link.
    }
  }

  const titleId = `act-title-${act.id}`;
  const reason = offBoardReason(act, picked, suggested);

  return (
    <div className="fixed inset-0 z-50" role="presentation">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-[#05080f]/70 backdrop-blur-sm cursor-default" />
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="olg-sheet olg-glass-deep absolute inset-x-0 bottom-0 max-h-[88vh] rounded-t-3xl sm:top-0 sm:bottom-0 sm:right-0 sm:left-auto sm:max-h-none sm:w-[30rem] sm:rounded-none sm:rounded-l-3xl sm:border-r-0 overflow-y-auto overscroll-contain outline-none"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 sm:px-7 py-4 border-b olg-hairline bg-[#0a1120]/80 backdrop-blur">
          <span className={`olg-note-label olg-note-${act.section} inline-flex items-center gap-2`}>
            <span className="olg-note-swatch inline-block w-2 h-2 rounded-full" aria-hidden />
            {SECTION_LABEL[act.section]}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onPrev ?? undefined}
              disabled={!onPrev}
              aria-label="Previous note"
              title="Previous (←)"
              className="olg-btn olg-btn-ghost !px-2.5 !py-2"
            >
              ←
            </button>
            <button
              type="button"
              onClick={onNext ?? undefined}
              disabled={!onNext}
              aria-label="Next note"
              title="Next (→)"
              className="olg-btn olg-btn-ghost !px-2.5 !py-2"
            >
              →
            </button>
            <button type="button" onClick={onClose} aria-label="Close" title="Close (Esc)" className="olg-btn olg-btn-ghost !px-2.5 !py-2 ml-1">
              ✕
            </button>
          </div>
        </div>

        <div className="px-5 sm:px-7 py-6">
          <p className="text-xs text-silver flex items-center gap-2 flex-wrap">
            <span className="text-foreground/85 font-medium">{actLabel(act)}</span>
            <span aria-hidden>·</span>
            <span>{formatDate(act.date)}</span>
          </p>
          <h3 id={titleId} className="mt-3 font-serif text-xl sm:text-[1.45rem] leading-snug" lang="az">
            {act.text}
          </h3>

          {act.topics.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {act.topics.map((t) => (
                <span key={t} className="olg-chip !py-1">
                  {TOPIC_LABEL[t]}
                </span>
              ))}
            </div>
          )}

          <StarRating act={act} onRate={onRate} />

          <div className="mt-6 flex flex-col gap-2.5">
            <a href={act.url} target="_blank" rel="noopener noreferrer" className="olg-btn olg-btn-primary justify-between">
              <span>Open the source</span>
              <span className="text-xs font-normal opacity-80">{sourceHost(act.url)} ↗</span>
            </a>
            <Link href={`/issues/${act.issue_number}`} className="olg-btn olg-btn-ghost justify-between">
              <span>Read it in the issue</span>
              <span className="text-xs font-normal text-silver">No. {act.issue_number} · act {String(act.position).padStart(2, "0")}</span>
            </Link>
            <button type="button" onClick={copyLink} className="olg-btn olg-btn-ghost justify-between">
              <span>Copy a link to this note</span>
              <span className="text-xs font-normal text-silver">{copied ? "Copied" : "for a colleague"}</span>
            </button>
          </div>

          <p className="mt-7 text-[0.7rem] leading-relaxed text-silver">
            The sentence is the gazette&rsquo;s own summary of the act, in Azerbaijani; the source link opens the official text.
            {reason ? ` ${reason}` : ""}
          </p>
        </div>
      </div>
    </div>
  );
}

function StarRating({ act, onRate }: { act: GazetteAct; onRate: (id: string, stars: number) => Promise<void> }) {
  const [mine, setMine] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const saved = Number(stored(VOTE_KEY(act.id)));
    setMine(saved >= 1 && saved <= 5 ? saved : null);
    setHover(null);
    setFailed(false);
  }, [act.id]);

  async function vote(stars: number) {
    setBusy(true);
    setFailed(false);
    try {
      await onRate(act.id, stars);
      setMine(stars);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const average = averageStars(act);
  const lit = hover ?? mine ?? 0;

  return (
    <div className="mt-6 olg-glass rounded-2xl px-4 py-3.5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-foreground/85">How much does this act matter?</p>
        <p className="text-xs text-silver tabular-nums">
          {average === null
            ? "No ratings yet"
            : `★ ${average.toFixed(1)} · ${act.rating_count} rating${act.rating_count === 1 ? "" : "s"}`}
        </p>
      </div>
      <div className="mt-2.5 flex items-center gap-3 flex-wrap">
        <div role="radiogroup" aria-label="Your rating, one to five stars" className="flex items-center" onMouseLeave={() => setHover(null)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={mine === n}
              aria-label={`${n} star${n === 1 ? "" : "s"}`}
              disabled={busy}
              onMouseEnter={() => setHover(n)}
              onFocus={() => setHover(n)}
              onBlur={() => setHover(null)}
              onClick={() => vote(n)}
              className={`olg-star ${n <= lit ? "olg-star-lit" : ""}`}
            >
              ★
            </button>
          ))}
        </div>
        <p className="text-xs text-silver">
          {failed
            ? "Could not save your rating; try again."
            : mine
              ? `You rated it ${mine} star${mine === 1 ? "" : "s"}. Tap a star to change it.`
              : `${RATING_MIN_VOTES} or more readers averaging under ${RATING_MIN_AVERAGE} take an act off the board.`}
        </p>
      </div>
    </div>
  );
}

/** The + note's sheet: the acts the board left out, one of which this reader may suggest. */
function SuggestPanel({
  candidates,
  mine,
  days,
  onSuggest,
  onOpen,
  onClose,
}: {
  candidates: GazetteAct[];
  mine: string | null;
  days: number;
  onSuggest: (id: string | null) => Promise<void>;
  onOpen: (id: string) => void;
  onClose: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    panel.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Your own suggestion first, then the board's usual order.
  const list = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("az");
    const hits = q
      ? candidates.filter((a) => `${actLabel(a)} ${a.text}`.toLocaleLowerCase("az").includes(q))
      : candidates;
    return [...hits].sort((a, b) => Number(b.id === mine) - Number(a.id === mine));
  }, [candidates, query, mine]);

  async function choose(id: string | null) {
    setBusy(id ?? mine);
    setMessage(null);
    try {
      await onSuggest(id);
      setMessage(id ? "Thank you. Your suggestion is in; the most suggested acts join the board." : "Your suggestion is withdrawn.");
    } catch {
      setMessage("Could not save your suggestion; try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50" role="presentation">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-[#05080f]/70 backdrop-blur-sm cursor-default" />
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="suggest-title"
        className="olg-sheet olg-glass-deep absolute inset-x-0 bottom-0 max-h-[88vh] rounded-t-3xl sm:top-0 sm:bottom-0 sm:right-0 sm:left-auto sm:max-h-none sm:w-[30rem] sm:rounded-none sm:rounded-l-3xl sm:border-r-0 overflow-y-auto overscroll-contain outline-none"
      >
        <div className="sticky top-0 z-10 px-5 sm:px-7 pt-4 pb-3.5 border-b olg-hairline bg-[#0a1120]/80 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <h3 id="suggest-title" className="font-serif text-xl">
              Suggest a note
            </h3>
            <button type="button" onClick={onClose} aria-label="Close" title="Close (Esc)" className="olg-btn olg-btn-ghost !px-2.5 !py-2">
              ✕
            </button>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-silver">
            {candidates.length} act{candidates.length === 1 ? "" : "s"} of the last {days} days didn&rsquo;t make the board. Pick the
            one that matters most; you have one suggestion, and choosing another moves it.
          </p>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the acts"
            aria-label="Search the acts"
            className="mt-3 w-full rounded-xl bg-white/5 border border-white/[0.12] px-3.5 py-2 text-sm text-foreground placeholder:text-silver/70 outline-none focus:border-azure/60"
          />
          {message && (
            <p role="status" className="mt-2.5 text-xs text-azure-soft">
              {message}
            </p>
          )}
        </div>

        <ul className="px-3 sm:px-4 py-3">
          {list.length === 0 && <li className="px-3 py-8 text-center text-sm text-silver">No act matches.</li>}
          {list.map((act) => {
            const isMine = act.id === mine;
            return (
              <li key={act.id} className={`rounded-2xl px-3.5 py-3.5 ${isMine ? "bg-omni/30 border border-azure/30" : ""}`}>
                <p className={`olg-note-${act.section} flex items-baseline justify-between gap-2`}>
                  <span className="olg-note-label">{actLabel(act)}</span>
                  <span className="text-[0.68rem] text-silver">{shortDate(act.date)}</span>
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-foreground/85 line-clamp-3" lang="az">
                  {act.text}
                </p>
                <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                  {isMine ? (
                    <>
                      <span className="olg-note-suggested">Your suggestion ✓</span>
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => choose(null)}
                        className="text-xs text-silver hover:text-white disabled:opacity-50"
                      >
                        {busy === act.id ? "…" : "Withdraw"}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => choose(act.id)}
                      className="olg-btn olg-btn-ghost !py-1.5 !px-3 text-xs"
                    >
                      {busy === act.id ? "…" : "+ Suggest this act"}
                    </button>
                  )}
                  <button type="button" onClick={() => onOpen(act.id)} className="text-xs text-azure hover:underline ml-auto">
                    Read →
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
