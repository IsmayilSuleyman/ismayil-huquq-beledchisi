import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth-guard";
import { listCourses, countLessons, countQuizzes } from "@/lib/content";
import {
  countPassed,
  courseProgress,
  getCompletedLessons,
  getHighlightCounts,
  getQuizBests,
  progressKey,
} from "@/lib/progress";
import { profileFromUser } from "@/lib/user";
import { AppHeader, LogoutButton } from "@/components/AppHeader";
import { ProgressBar } from "@/components/ProgressBar";
import { StatTile } from "@/components/StatTile";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Hesab" };

export default async function AccountPage() {
  const user = await requireUser("/account");
  const profile = profileFromUser(user);
  const [courses, completed, bests, highlightCounts] = await Promise.all([
    listCourses(),
    getCompletedLessons(user.id),
    getQuizBests(user.id),
    getHighlightCounts(user.id),
  ]);
  // Lessons the reader has marked up, in course order, for the notebook list.
  const notebook = courses.flatMap((course) =>
    course.lessons.flatMap((lesson, i) => {
      const counts = highlightCounts.get(progressKey(course.slug, lesson.slug));
      return counts
        ? [{ course, lesson, index: i + 1, ...counts }]
        : [];
    }),
  );
  const totalLessons = countLessons(courses);
  const totalQuizzes = countQuizzes(courses);
  const passed = countPassed(bests);
  const joined = user.created_at
    ? new Date(user.created_at).toLocaleDateString("az-AZ", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <main className="mx-auto w-full max-w-5xl px-6 pb-16">
      <AppHeader name={profile.firstName} avatarUrl={profile.avatarUrl} />

      <header className="mb-10 flex items-center gap-5">
        {profile.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatarUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="h-16 w-16 rounded-full border border-ink/10 object-cover dark:border-white/15"
          />
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-wood-mist text-2xl font-semibold text-brand-wood dark:bg-white/10 dark:text-brand-brass-soft">
            {profile.fullName.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div>
          <h1 className="text-[clamp(1.8rem,3.4vw,2.5rem)] font-semibold leading-tight tracking-[-0.02em] text-ink dark:text-brand-cream">
            {profile.fullName}
          </h1>
          <p className="mt-1 text-sm text-ink/55 dark:text-white/55">
            {profile.email}
            {joined ? ` · Qeydiyyat: ${joined}` : ""}
          </p>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Kurslar" value={courses.length} />
        <StatTile label="Dərslər" value={totalLessons} />
        <StatTile
          label="Keçilmiş testlər"
          value={passed}
          tone={passed > 0 ? "positive" : "neutral"}
          sub={totalQuizzes > 0 ? `${totalQuizzes} testdən` : undefined}
        />
        <StatTile
          label="Tamamlanıb"
          value={completed.size}
          tone={completed.size > 0 ? "positive" : "neutral"}
          sub={
            totalLessons > 0
              ? `${Math.round((completed.size / totalLessons) * 100)}% ümumi irəliləyiş`
              : undefined
          }
        />
      </section>

      <section className="mt-12">
        <h2 className="mb-4 text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-brass">
          Kurslar üzrə irəliləyiş
        </h2>
        {courses.length === 0 ? (
          <div className="glass p-6 text-sm text-ink/55 dark:text-white/55">
            Hələ heç bir kurs yoxdur.
          </div>
        ) : (
          <ul className="glass divide-y divide-brand-wood-ring/60 dark:divide-white/10">
            {courses.map((course) => {
              const progress = courseProgress(course, completed);
              return (
                <li key={course.slug} className="px-5 py-5 sm:px-6">
                  <div className="flex items-center justify-between gap-4">
                    <Link
                      href={`/courses/${course.slug}`}
                      className="text-lg font-semibold text-ink transition hover:text-brand-wood dark:text-brand-cream dark:hover:text-brand-brass-soft"
                    >
                      {course.title}
                    </Link>
                    <span className="num text-[11px] uppercase tracking-[0.16em] text-ink/45 dark:text-white/45">
                      {progress.completed}/{progress.total}
                    </span>
                  </div>
                  <ProgressBar percent={progress.percent} className="mt-3" />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {notebook.length > 0 ? (
        <section className="mt-12">
          <h2 className="mb-4 text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-brass">
            Qeyd dəftəri
          </h2>
          <ul className="glass divide-y divide-brand-wood-ring/60 dark:divide-white/10">
            {notebook.map((row) => (
              <li
                key={`${row.course.slug}/${row.lesson.slug}`}
                className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6"
              >
                <div className="min-w-0">
                  <Link
                    href={`/courses/${row.course.slug}/${row.lesson.slug}#qeydler`}
                    className="block truncate text-base font-semibold text-ink transition hover:text-brand-wood dark:text-brand-cream dark:hover:text-brand-brass-soft"
                  >
                    {row.lesson.title}
                  </Link>
                  <p className="mt-0.5 truncate text-xs text-ink/45 dark:text-white/45">
                    {row.course.title} · Dərs {row.index}
                  </p>
                </div>
                <span className="num shrink-0 text-right text-[11px] uppercase tracking-[0.16em] text-ink/45 dark:text-white/45">
                  {row.highlights} işarələmə
                  <br className="sm:hidden" />
                  <span className="hidden sm:inline"> · </span>
                  {row.notes} qeyd
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-12 flex flex-col items-start gap-3">
        <LogoutButton />
        <p className="text-xs leading-5 text-ink/45 dark:text-white/45">
          Hesabınız Google vasitəsilə yaradılıb. Çıxış etdikdən sonra eyni
          hesabla yenidən daxil ola bilərsiniz; irəliləyişiniz saxlanılır.
        </p>
      </section>
    </main>
  );
}
