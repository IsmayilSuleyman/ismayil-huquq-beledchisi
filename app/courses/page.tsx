import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth-guard";
import { listCourses } from "@/lib/content";
import { courseProgress, getCompletedLessons } from "@/lib/progress";
import { profileFromUser } from "@/lib/user";
import { AppHeader } from "@/components/AppHeader";
import { ProgressBar } from "@/components/ProgressBar";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Kurslar" };

export default async function CoursesPage() {
  const user = await requireUser("/courses");
  const profile = profileFromUser(user);
  const [courses, completed] = await Promise.all([
    listCourses(),
    getCompletedLessons(user.id),
  ]);

  return (
    <main className="mx-auto w-full max-w-5xl px-6 pb-16">
      <AppHeader name={profile.firstName} avatarUrl={profile.avatarUrl} />

      <header className="mb-10">
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-brass">
          Xoş gəlmisiniz, {profile.firstName}
        </div>
        <h1 className="mt-3 text-[clamp(2rem,4vw,2.8rem)] font-semibold leading-tight tracking-[-0.02em] text-ink dark:text-brand-cream">
          Kurslar
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-ink/55 dark:text-white/55">
          Kursu seçin və dərsləri ardıcıllıqla keçin. Tamamladığınız dərslər
          hesabınızda qeyd olunur.
        </p>
      </header>

      {courses.length === 0 ? (
        <div className="glass p-8 text-sm text-ink/55 dark:text-white/55">
          Hələ heç bir kurs əlavə edilməyib.
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {courses.map((course) => {
            const progress = courseProgress(course, completed);
            return (
              <Link
                key={course.slug}
                href={`/courses/${course.slug}`}
                className="glass group flex flex-col p-6 transition hover:-translate-y-0.5 hover:shadow-glass-wood"
              >
                <div className="flex items-center justify-between gap-3">
                  {course.level ? (
                    <span className="rounded-full border border-brand-brass/40 px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-brand-brass">
                      {course.level}
                    </span>
                  ) : (
                    <span />
                  )}
                  <span className="num text-[11px] uppercase tracking-[0.16em] text-ink/45 dark:text-white/45">
                    {course.lessons.length} dərs
                  </span>
                </div>
                <h2 className="mt-4 text-2xl font-semibold leading-snug text-ink transition group-hover:text-brand-wood dark:text-brand-cream dark:group-hover:text-brand-brass-soft">
                  {course.title}
                </h2>
                <p className="mt-3 flex-1 text-sm leading-6 text-ink/55 dark:text-white/55">
                  {course.description}
                </p>
                <div className="mt-6">
                  <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-ink/45 dark:text-white/45">
                    <span>İrəliləyiş</span>
                    <span className="num">
                      {progress.completed}/{progress.total}
                    </span>
                  </div>
                  <ProgressBar percent={progress.percent} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
