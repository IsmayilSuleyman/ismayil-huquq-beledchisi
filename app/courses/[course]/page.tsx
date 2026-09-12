import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth-guard";
import { getCourse } from "@/lib/content";
import { courseProgress, getCompletedLessons, progressKey } from "@/lib/progress";
import { profileFromUser } from "@/lib/user";
import { AppHeader } from "@/components/AppHeader";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ProgressBar } from "@/components/ProgressBar";
import { StatTile } from "@/components/StatTile";

export const dynamic = "force-dynamic";

type Params = Promise<{ course: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { course: slug } = await params;
  const course = await getCourse(slug);
  return { title: course?.title ?? "Kurs" };
}

export default async function CoursePage({ params }: { params: Params }) {
  const { course: slug } = await params;
  const user = await requireUser(`/courses/${slug}`);
  const profile = profileFromUser(user);
  const [course, completed] = await Promise.all([
    getCourse(slug),
    getCompletedLessons(user.id),
  ]);
  if (!course) notFound();

  const progress = courseProgress(course, completed);
  const totalMinutes = course.lessons.reduce((s, l) => s + (l.minutes ?? 0), 0);
  const continueHref = progress.nextLessonSlug
    ? `/courses/${course.slug}/${progress.nextLessonSlug}`
    : course.lessons[0]
      ? `/courses/${course.slug}/${course.lessons[0].slug}`
      : null;

  return (
    <main className="mx-auto w-full max-w-5xl px-6 pb-16">
      <AppHeader name={profile.firstName} avatarUrl={profile.avatarUrl} />
      <Breadcrumbs items={[{ href: "/courses", label: "Kurslar" }, { label: course.title }]} />

      <header className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-end">
        <div>
          {course.level ? (
            <span className="rounded-full border border-brand-brass/40 px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-brand-brass">
              {course.level}
            </span>
          ) : null}
          <h1 className="mt-4 font-serif text-[clamp(2rem,4vw,2.9rem)] font-semibold leading-tight tracking-[-0.02em] text-ink dark:text-brand-cream">
            {course.title}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-ink/60 dark:text-white/60">
            {course.description}
          </p>
          {continueHref ? (
            <Link
              href={continueHref}
              className="mt-8 inline-block rounded-xl bg-brand-wood px-6 py-3.5 text-sm font-medium uppercase tracking-[0.16em] text-brand-cream shadow-glass-wood transition hover:-translate-y-0.5 hover:bg-brand-wood-deep"
            >
              {progress.completed === 0
                ? "Kursa başlayın"
                : progress.nextLessonSlug
                  ? "Davam edin"
                  : "Yenidən baxın"}
            </Link>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <StatTile label="Dərslər" value={course.lessons.length} />
          <StatTile
            label="Tamamlanıb"
            value={progress.completed}
            tone={progress.completed > 0 ? "positive" : "neutral"}
            sub={`${progress.percent}%`}
          />
          {totalMinutes > 0 ? (
            <StatTile
              label="Ümumi müddət"
              value={totalMinutes}
              sub="dəqiqə"
              className="glass col-span-2 flex flex-col gap-2 p-6 sm:col-span-1"
            />
          ) : null}
        </div>
      </header>

      <section className="mt-12">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-brass">
            Dərslər
          </h2>
          <span className="num text-[11px] uppercase tracking-[0.16em] text-ink/45 dark:text-white/45">
            {progress.completed}/{progress.total}
          </span>
        </div>
        <ProgressBar percent={progress.percent} className="mb-6" />

        <ol className="glass divide-y divide-brand-wood-ring/60 dark:divide-white/10">
          {course.lessons.map((lesson, i) => {
            const done = completed.has(progressKey(course.slug, lesson.slug));
            return (
              <li key={lesson.slug}>
                <Link
                  href={`/courses/${course.slug}/${lesson.slug}`}
                  className="group flex items-start gap-4 px-5 py-5 transition hover:bg-white/40 dark:hover:bg-white/5 sm:px-6"
                >
                  <span
                    className={`num mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                      done
                        ? "bg-status-done text-white dark:bg-brand-brass dark:text-ink"
                        : "bg-brand-wood-mist text-brand-wood dark:bg-white/10 dark:text-brand-brass-soft"
                    }`}
                  >
                    {done ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M5 12.5l4.5 4.5L19 7.5" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-serif text-lg font-semibold leading-snug text-ink transition group-hover:text-brand-wood dark:text-brand-cream dark:group-hover:text-brand-brass-soft">
                      {lesson.title}
                    </span>
                    {lesson.summary ? (
                      <span className="mt-1 block text-sm leading-6 text-ink/55 dark:text-white/55">
                        {lesson.summary}
                      </span>
                    ) : null}
                  </span>
                  {lesson.minutes ? (
                    <span className="num shrink-0 text-[11px] uppercase tracking-[0.16em] text-ink/45 dark:text-white/45">
                      {lesson.minutes} dəq
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ol>
      </section>
    </main>
  );
}
