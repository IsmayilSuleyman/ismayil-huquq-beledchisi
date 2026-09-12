"use client";

import { useState, useTransition } from "react";
import { submitQuiz } from "@/app/(guide)/courses/[course]/[lesson]/actions";
import type { PublicQuestion, QuestionResult } from "@/lib/quiz";
import type { QuizBest } from "@/lib/progress";

type Outcome = {
  score: number;
  total: number;
  percent: number;
  passed: boolean;
  lessonCompleted: boolean;
  results: Map<string, QuestionResult>;
};

const LETTERS = ["A", "B", "C", "D", "E", "F"];

export function LessonQuiz({
  courseSlug,
  lessonSlug,
  questions,
  pass,
  best,
}: {
  courseSlug: string;
  lessonSlug: string;
  questions: PublicQuestion[];
  pass: number;
  best: QuizBest | null;
}) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const answered = questions.filter((q) => answers[q.id] !== undefined).length;
  const allAnswered = answered === questions.length;

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await submitQuiz(courseSlug, lessonSlug, answers);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setOutcome({
        score: result.score,
        total: result.total,
        percent: result.percent,
        passed: result.passed,
        lessonCompleted: result.lessonCompleted,
        results: new Map(result.results.map((r) => [r.id, r])),
      });
    });
  };

  const reset = () => {
    setAnswers({});
    setOutcome(null);
    setError(null);
  };

  return (
    <section aria-labelledby="quiz-heading" className="mt-12">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-brass">
            Dərs üzrə test
          </p>
          <h2
            id="quiz-heading"
            className="mt-1 text-2xl font-semibold tracking-[-0.02em] text-ink dark:text-brand-cream"
          >
            Biliyinizi yoxlayın
          </h2>
        </div>
        <p className="num text-[11px] uppercase tracking-[0.16em] text-ink/45 dark:text-white/45">
          {questions.length} sual · keçid həddi {pass}%
          {best ? ` · ən yaxşı nəticə ${best.percent}%` : ""}
        </p>
      </div>

      <div className="glass-strong px-6 py-8 sm:px-10 sm:py-10">
        <ol className="space-y-8">
          {questions.map((q, qi) => {
            const res = outcome?.results.get(q.id) ?? null;
            return (
              <li key={q.id}>
                <fieldset disabled={!!outcome || pending}>
                  <legend className="text-base font-semibold leading-7 text-ink dark:text-brand-cream">
                    <span className="num mr-2 text-brand-brass">{qi + 1}.</span>
                    {q.prompt}
                  </legend>
                  <div className="mt-3 grid gap-2">
                    {q.options.map((opt, oi) => {
                      const chosen = answers[q.id] === oi;
                      let tone =
                        "border-brand-wood-ring/70 bg-white/40 hover:border-brand-wood/40 dark:border-white/10 dark:bg-white/5 dark:hover:border-brand-brass/40";
                      if (chosen && !res) {
                        tone =
                          "border-brand-wood bg-brand-wood-mist dark:border-brand-brass dark:bg-white/10";
                      }
                      if (res && oi === res.correct) {
                        tone =
                          "border-status-done bg-status-done-soft dark:border-brand-brass dark:bg-white/10";
                      } else if (res && chosen && !res.isCorrect) {
                        tone = "border-brand-red/60 bg-brand-red/5 dark:border-red-400/60";
                      }
                      return (
                        <label
                          key={oi}
                          className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm leading-6 text-ink transition dark:text-brand-cream ${tone} ${
                            outcome ? "cursor-default" : ""
                          }`}
                        >
                          <input
                            type="radio"
                            name={q.id}
                            value={oi}
                            checked={chosen}
                            onChange={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}
                            className="sr-only"
                          />
                          <span
                            aria-hidden
                            className={`num mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                              chosen
                                ? "bg-brand-wood text-brand-cream dark:bg-brand-brass dark:text-ink"
                                : "bg-brand-wood-mist text-brand-wood dark:bg-white/10 dark:text-brand-brass-soft"
                            }`}
                          >
                            {LETTERS[oi] ?? oi + 1}
                          </span>
                          <span>{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
                {res ? (
                  <p
                    className={`mt-3 rounded-xl px-4 py-3 text-sm leading-6 ${
                      res.isCorrect
                        ? "bg-status-done-soft text-status-done dark:bg-white/10 dark:text-brand-brass-soft"
                        : "bg-brand-red/5 text-ink/80 dark:bg-white/5 dark:text-white/80"
                    }`}
                  >
                    <span className="font-semibold">
                      {res.isCorrect ? "Düzgün." : "Yanlış."}
                    </span>{" "}
                    {res.explanation}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>

        <div className="mt-10 flex flex-col gap-4 border-t border-brand-wood-ring/70 pt-6 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
          {outcome ? (
            <>
              <div>
                <p className="num text-2xl font-semibold text-ink dark:text-brand-cream">
                  {outcome.score} / {outcome.total}
                  <span className="ml-2 text-base font-medium text-ink/55 dark:text-white/55">
                    {outcome.percent}%
                  </span>
                </p>
                <p className="mt-1 text-sm text-ink/60 dark:text-white/60">
                  {outcome.passed
                    ? outcome.lessonCompleted
                      ? "Test keçildi; dərs tamamlanmış kimi qeyd olundu."
                      : "Test keçildi."
                    : `Keçid həddi ${pass}%-dir. Dərsi yenidən oxuyub təkrar cəhd edin.`}
                </p>
              </div>
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center justify-center rounded-xl border border-brand-wood/30 px-5 py-3 text-sm font-medium uppercase tracking-[0.14em] text-brand-wood transition hover:-translate-y-0.5 hover:bg-brand-wood-mist dark:border-brand-brass/40 dark:text-brand-brass-soft dark:hover:bg-white/10"
              >
                Yenidən cəhd edin
              </button>
            </>
          ) : (
            <>
              <p className="num text-sm text-ink/55 dark:text-white/55">
                {answered} / {questions.length} cavablandırılıb
              </p>
              <button
                type="button"
                onClick={submit}
                disabled={!allAnswered || pending}
                className="inline-flex items-center justify-center rounded-xl bg-brand-wood px-6 py-3 text-sm font-medium uppercase tracking-[0.14em] text-brand-cream shadow-glass-wood transition hover:-translate-y-0.5 hover:bg-brand-wood-deep disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {pending ? "Yoxlanılır…" : "Cavabları yoxlayın"}
              </button>
            </>
          )}
        </div>
        {error ? <p className="mt-3 text-xs text-brand-red dark:text-red-400">{error}</p> : null}
      </div>
    </section>
  );
}
