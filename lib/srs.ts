/**
 * Spaced repetition in the style of Anki's SM-2 scheduler. Pure functions:
 * the server action applies `schedule` to the stored state, the review
 * screen uses the same function to show what each rating would do.
 *
 * Ratings: 1 Yenidən (again), 2 Çətin (hard), 3 Yaxşı (good), 4 Asan (easy).
 */

export type Rating = 1 | 2 | 3 | 4;

export type CardState = {
  /** Ease factor; 2.5 to start, never below 1.3. */
  ease: number;
  /** Days until the next review; 0 while a card is being (re)learned. */
  intervalDays: number;
  /** Successful reviews in a row. */
  repetitions: number;
  /** Times the card was forgotten. */
  lapses: number;
  /** ISO timestamp of the next review. */
  dueAt: string;
  /** Total reviews recorded. */
  reviews: number;
};

export const RATINGS: { value: Rating; label: string; key: string }[] = [
  { value: 1, label: "Yenidən", key: "1" },
  { value: 2, label: "Çətin", key: "2" },
  { value: 3, label: "Yaxşı", key: "3" },
  { value: 4, label: "Asan", key: "4" },
];

export const MIN_EASE = 1.3;
export const AGAIN_DELAY_MINUTES = 10;

export function newState(now: Date = new Date()): CardState {
  return { ease: 2.5, intervalDays: 0, repetitions: 0, lapses: 0, dueAt: now.toISOString(), reviews: 0 };
}

export function isRating(value: unknown): value is Rating {
  return value === 1 || value === 2 || value === 3 || value === 4;
}

const DAY_MS = 86_400_000;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Next state after rating a card now. */
export function schedule(state: CardState, rating: Rating, now: Date = new Date()): CardState {
  const base = { ...state, reviews: state.reviews + 1 };

  if (rating === 1) {
    return {
      ...base,
      ease: round2(Math.max(MIN_EASE, state.ease - 0.2)),
      intervalDays: 0,
      repetitions: 0,
      lapses: state.lapses + 1,
      dueAt: new Date(now.getTime() + AGAIN_DELAY_MINUTES * 60_000).toISOString(),
    };
  }

  let ease = state.ease;
  let interval: number;
  if (rating === 2) {
    ease = Math.max(MIN_EASE, ease - 0.15);
    interval = Math.max(1, Math.round(state.intervalDays * 1.2));
  } else if (rating === 3) {
    interval =
      state.repetitions === 0 ? 1 : state.repetitions === 1 ? 6 : Math.round(state.intervalDays * ease);
  } else {
    ease = ease + 0.15;
    interval = state.repetitions === 0 ? 4 : Math.round(state.intervalDays * ease * 1.3);
  }
  interval = Math.max(1, Math.min(interval, 365));

  return {
    ...base,
    ease: round2(ease),
    intervalDays: interval,
    repetitions: state.repetitions + 1,
    dueAt: new Date(now.getTime() + interval * DAY_MS).toISOString(),
  };
}

export function isDue(state: CardState, now: Date = new Date()): boolean {
  return new Date(state.dueAt).getTime() <= now.getTime();
}

/** "10 dəq", "1 gün", "3 həftə", "2 ay" — what a rating button promises. */
export function formatInterval(state: CardState, rating: Rating, now: Date = new Date()): string {
  const next = schedule(state, rating, now);
  if (next.intervalDays === 0) return `${AGAIN_DELAY_MINUTES} dəq`;
  const d = next.intervalDays;
  if (d < 7) return `${d} gün`;
  if (d < 30) return `${Math.round(d / 7)} həftə`;
  if (d < 365) return `${Math.round(d / 30)} ay`;
  return "1 il";
}
