"use client";

import { useState, useTransition } from "react";
import { setLessonCompleted } from "@/app/(guide)/courses/[course]/[lesson]/actions";

export function CompleteToggle({
  courseSlug,
  lessonSlug,
  initialCompleted,
}: {
  courseSlug: string;
  lessonSlug: string;
  initialCompleted: boolean;
}) {
  const [completed, setCompleted] = useState(initialCompleted);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    const next = !completed;
    setCompleted(next); // optimistic
    setError(null);
    startTransition(async () => {
      const result = await setLessonCompleted(courseSlug, lessonSlug, next);
      if (!result.ok) {
        setCompleted(!next);
        setError(result.message);
      }
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={completed}
        className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-medium uppercase tracking-[0.14em] transition hover:-translate-y-0.5 disabled:opacity-70 disabled:hover:translate-y-0 ${
          completed
            ? "border border-status-done/30 bg-status-done-soft text-status-done dark:border-brand-brass/40 dark:bg-white/10 dark:text-brand-brass-soft"
            : "bg-brand-wood text-brand-cream shadow-glass-wood hover:bg-brand-wood-deep"
        }`}
      >
        {completed ? (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
            Tamamlandı
          </>
        ) : (
          "Dərsi tamamlandı kimi qeyd et"
        )}
      </button>
      {completed ? (
        <span className="text-[11px] text-ink/45 dark:text-white/45">
          Qeydi ləğv etmək üçün yenidən toxunun.
        </span>
      ) : null}
      {error ? (
        <span className="text-xs text-brand-red dark:text-red-400">{error}</span>
      ) : null}
    </div>
  );
}
