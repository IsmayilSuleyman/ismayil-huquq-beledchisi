import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth-guard";
import { listCourses, countLessons, countQuizzes } from "@/lib/content";
import {
  countPassed,
  courseProgress,
  getCompletedLessons,
  getQuizBests,
  progressKey,
} from "@/lib/progress";
import { profileFromUser } from "@/lib/user";
import { AppHeader } from "@/components/AppHeader";
import { ProgressBar } from "@/components/ProgressBar";
import { StatTile } from "@/components/StatTile";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Öyrən" };

/**
 * The learner's own desk: where to continue, how far each course has come,
 * and which tests are still open. Courses are listed with their next lesson;
 * a finished course shows its last lesson for review.
 */
export default async function LearnPage() {
  const user = await requireUser("/learn");
  const profile = profileFromUser(user);
  const [courses, completed, bests] = await Promise.all([
    listCourses(),
    getCompletedLessons(user.id),
    getQuizBests(user.id),
  ]);

  const totalLessons = countLessons(courses);
  const totalQuizzes = countQuizzes(courses);
  const passed = countPassed(bests);

  // The course to continue: the first one with an open lesson, else the first.
  const plans = courses.map((course) => {
    const progress = courseProgress(course, completed);
    const next = progress.nextLessonSlug
      ? course.lessons.find((l) => l.slug === progress.nextLessonSlug) ?? null
      : null;
    const openTests = course.lessons.filter(
      (l) => l.hasQuiz && !bests.get(progressKey(course.slug, l.slug))?.passed,
    );
    return { course, progress, next, openTests };
  });
  const focus = plans.find((p) => p.next) ?? plans[0] ?? null;

  return (
    <main className="mx-auto w-full max-w-5xl px-6 pb-16">
      <AppHeader name={profile.firstName} avatarUrl={profile.avatarUrl} />

      <header className="mb-10">
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-brass">
          Xoş gəlmisiniz, {profile.firstName}
        </div>
        <h1 className="mt-3 text-[clamp(2rem,4vw,2.8rem)] font-semibold leading-tight tracking-[-0.02em] text-ink dark:text-brand-cream">
          Öyrən
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-ink/55 dark:text-white/55">
          Qaldığınız yerdən davam edin. İrəliləyişiniz və test nəticələriniz
          hesabınızda saxlanılır.
        </p>
      </header>

      {focus ? (
        <section className="glass-tinted grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.4fr_1fr] lg:items-center">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-brass">
              {focus.next ? "Növbəti dərs" : "Kurs tamamlanıb"}
            </p>
            <p className="mt-2 text-sm text-ink/55 dark:text-white/55">{focus.course.title}</p>
            <h2 className="mt-1 text-2xl font-semibold leading-snug tracking-[-0.02em] text-ink dark:text-brand-cream">
              {focus.next ? focus.next.title : "Bütün dərslər keçilib"}
            </h2>
            {focus.next?.summary ? (
              <p className="mt-3 text-sm leading-6 text-ink/60 dark:text-white/60">
                {focus.next.summary}
              </p>
            ) : null}
            <Link
              href={
                focus.next
                  ? `/courses/${focus.course.slug}/${focus.next.slug}`
                  : `/courses/${focus.course.slug}`
              }
              className="mt-6 inline-block rounded-xl bg-brand-wood px-6 py-3.5 text-sm font-medium uppercase tracking-[0.16em] text-brand-cream shadow-glass-wood transition hover:-translate-y-0.5 hover:bg-brand-wood-deep"
            >
              {focus.next
                ? focus.progress.completed === 0
                  ? "Kursa başlayın"
                  : "Davam edin"
                : "Kursa yenidən baxın"}
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <StatTile
              label="Dərslər"
              value={completed.size}
              sub={`${totalLessons} dərsdən keçilib`}
              tone={completed.size > 0 ? "positive" : "neutral"}
            />
            <StatTile
              label="Testlər"
              value={passed}
              sub={totalQuizzes > 0 ? `${totalQuizzes} testdən keçilib` : undefined}
              tone={passed > 0 ? "positive" : "neutral"}
            />
          </div>
        </section>
      ) : (
        <div className="glass p-8 text-sm text-ink/55 dark:text-white/55">
          Hələ heç bir kurs əlavə edilməyib.
        </div>
      )}

      {plans.length > 0 ? (
        <section className="mt-12">
          <h2 className="mb-4 text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-brass">
            Kurslarınız
          </h2>
          <ul className="grid gap-5 md:grid-cols-2">
            {plans.map(({ course, progress, next, openTests }) => (
              <li key={course.slug} className="glass flex flex-col p-6">
                <div className="flex items-start justify-between gap-4">
                  <Link
                    href={`/courses/${course.slug}`}
                    className="text-lg font-semibold leading-snug text-ink transition hover:text-brand-wood dark:text-brand-cream dark:hover:text-brand-brass-soft"
                  >
                    {course.title}
                  </Link>
                  <span className="num shrink-0 text-[11px] uppercase tracking-[0.16em] text-ink/45 dark:text-white/45">
                    {progress.completed}/{progress.total}
                  </span>
                </div>
                <ProgressBar percent={progress.percent} className="mt-4" />
                <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-[10px] uppercase tracking-[0.18em] text-ink/45 dark:text-white/45">
                      Növbəti
                    </dt>
                    <dd className="mt-1 leading-6 text-ink/80 dark:text-white/80">
                      {next ? next.title : "Tamamlanıb"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-[0.18em] text-ink/45 dark:text-white/45">
                      Açıq testlər
                    </dt>
                    <dd className="num mt-1 leading-6 text-ink/80 dark:text-white/80">
                      {openTests.length === 0
                        ? "Hamısı keçilib"
                        : `${openTests.length} test`}
                    </dd>
                  </div>
                </dl>
                {openTests.length > 0 ? (
                  <ul className="mt-4 space-y-1.5">
                    {openTests.map((l) => (
                      <li key={l.slug}>
                        <Link
                          href={`/courses/${course.slug}/${l.slug}#quiz-heading`}
                          className="text-xs text-brand-wood underline-offset-4 hover:underline dark:text-brand-brass-soft"
                        >
                          {l.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
