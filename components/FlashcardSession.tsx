"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { reviewCard } from "@/app/(guide)/learn/actions";
import type { Card } from "@/lib/decks";
import { RATINGS, formatInterval, newState, schedule, type CardState, type Rating } from "@/lib/srs";

/** How many cards later a forgotten card comes back within the session. */
const AGAIN_GAP = 3;

const RATING_STYLE: Record<Rating, string> = {
  1: "border-brand-red/40 text-brand-red hover:bg-brand-red/5 dark:border-red-400/50 dark:text-red-300",
  2: "border-brand-brass/50 text-brand-wood hover:bg-brand-wood-mist dark:text-brand-brass-soft dark:hover:bg-white/10",
  3: "border-status-done/40 text-status-done hover:bg-status-done-soft dark:border-brand-brass/50 dark:text-brand-brass-soft dark:hover:bg-white/10",
  4: "border-status-done/40 text-status-done hover:bg-status-done-soft dark:border-brand-brass/50 dark:text-brand-brass-soft dark:hover:bg-white/10",
};

export function FlashcardSession({
  deckSlug,
  deckTitle,
  cards: initialCards,
  initialStates,
}: {
  deckSlug: string;
  deckTitle: string;
  /** Session queue, in order: due cards first, then new ones. */
  cards: Card[];
  initialStates: Record<string, CardState>;
}) {
  // The queue is fixed at mount. A refresh from the server mid-session would
  // hand us a different list (rated cards drop out of it), and a card rated
  // "Yenidən" must still be findable when it comes back around.
  const [cards] = useState(initialCards);
  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const [queue, setQueue] = useState<string[]>(() => cards.map((c) => c.id));
  const [states, setStates] = useState<Record<string, CardState>>(initialStates);
  const [revealed, setRevealed] = useState(false);
  const [tally, setTally] = useState<Record<Rating, number>>({ 1: 0, 2: 0, 3: 0, 4: 0 });
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const currentId = queue[0] ?? null;
  const current = currentId ? byId.get(currentId) ?? null : null;
  const currentState = currentId ? states[currentId] ?? newState() : newState();
  const reviewedCount = tally[1] + tally[2] + tally[3] + tally[4];

  // Optimistic: the next card shows at once and the save runs behind it.
  // The server recomputes the schedule from its own copy; if the save fails
  // the card returns to the front of the queue with the previous state.
  const rate = useCallback(
    (rating: Rating) => {
      if (!currentId) return;
      const previous = states[currentId] ?? newState();
      const predicted = schedule(previous, rating);
      setError(null);
      setStates((s) => ({ ...s, [currentId]: predicted }));
      setTally((t) => ({ ...t, [rating]: t[rating] + 1 }));
      setQueue((q) => {
        const rest = q[0] === currentId ? q.slice(1) : q;
        if (rating !== 1) return rest;
        const at = Math.min(AGAIN_GAP, rest.length);
        return [...rest.slice(0, at), currentId, ...rest.slice(at)];
      });
      setRevealed(false);
      startTransition(async () => {
        const result = await reviewCard(deckSlug, currentId, rating);
        if (result.ok) {
          setStates((s) => ({ ...s, [currentId]: result.state }));
          return;
        }
        setError(result.message);
        setStates((s) => ({ ...s, [currentId]: previous }));
        setTally((t) => ({ ...t, [rating]: Math.max(0, t[rating] - 1) }));
        setQueue((q) => [currentId, ...q.filter((id) => id !== currentId)]);
      });
    },
    [currentId, deckSlug, states],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!current) return;
      if (e.target instanceof HTMLElement && ["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;
      if (!revealed && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        setRevealed(true);
      } else if (revealed && ["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        rate(Number(e.key) as Rating);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, revealed, rate]);

  if (!current) {
    return (
      <section className="glass-tinted p-8 text-center sm:p-12">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-brass">
          {deckTitle}
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-[-0.02em] text-ink dark:text-brand-cream">
          {reviewedCount > 0 ? "Bugünkü təkrar tamamlandı" : "Hazırda təkrar üçün kart yoxdur"}
        </h2>
        {reviewedCount > 0 ? (
          <dl className="num mx-auto mt-6 grid max-w-md grid-cols-4 gap-3 text-sm">
            {RATINGS.map((r) => (
              <div key={r.value} className="glass p-3">
                <dt className="text-[9px] uppercase tracking-[0.18em] text-ink/45 dark:text-white/45">{r.label}</dt>
                <dd className="mt-1 text-lg font-semibold text-ink dark:text-brand-cream">{tally[r.value]}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-3 text-sm text-ink/55 dark:text-white/55">
            Kartlar vaxtı çatanda yenidən görünəcək. Digər dəstlərə baxın.
          </p>
        )}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/learn"
            className="rounded-xl bg-brand-wood px-6 py-3 text-sm font-medium uppercase tracking-[0.14em] text-brand-cream shadow-glass-wood transition hover:-translate-y-0.5 hover:bg-brand-wood-deep"
          >
            Bütün dəstlər
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section aria-live="polite">
      <div className="mb-4 flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-ink/45 dark:text-white/45">
        <span className="num">Qalıb: {queue.length}</span>
        <span className="num">Bu sessiya: {reviewedCount}</span>
      </div>

      <div className="glass-strong flex min-h-[22rem] flex-col p-6 sm:p-10">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-brass">
          {currentState.reviews === 0 ? "Yeni kart" : `Təkrar · ${currentState.repetitions} ardıcıl`}
        </p>
        <p className="mt-5 text-xl font-semibold leading-relaxed tracking-[-0.01em] text-ink dark:text-brand-cream sm:text-2xl">
          {current.front}
        </p>
        {current.hint && !revealed ? (
          <p className="mt-3 text-sm text-ink/45 dark:text-white/45">İpucu: {current.hint}</p>
        ) : null}

        {revealed ? (
          <div className="mt-6 border-t border-brand-wood-ring/70 pt-6 dark:border-white/10">
            <p className="text-base leading-7 text-ink/85 dark:text-white/85">{current.back}</p>
          </div>
        ) : null}

        <div className="mt-auto pt-8">
          {!revealed ? (
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="w-full rounded-xl bg-brand-wood px-6 py-3.5 text-sm font-medium uppercase tracking-[0.14em] text-brand-cream shadow-glass-wood transition hover:-translate-y-0.5 hover:bg-brand-wood-deep sm:w-auto"
            >
              Cavabı göstər
              <span className="ml-3 hidden text-[10px] text-brand-cream/60 sm:inline">boşluq</span>
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {RATINGS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => rate(r.value)}
                  className={`flex flex-col items-center rounded-xl border px-3 py-3 transition hover:-translate-y-0.5 ${RATING_STYLE[r.value]}`}
                >
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">{r.label}</span>
                  <span className="num mt-1 text-xs opacity-70">{formatInterval(currentState, r.value)}</span>
                  <span className="mt-1 hidden text-[9px] opacity-50 sm:inline">{r.key}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {error ? <p className="mt-3 text-xs text-brand-red dark:text-red-400">{error}</p> : null}
    </section>
  );
}
