import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth-guard";
import { listCourses, countLessons } from "@/lib/content";
import { courseProgress, getCompletedLessons } from "@/lib/progress";
import { profileFromUser } from "@/lib/user";
import { AppHeader } from "@/components/AppHeader";
import { ProgressBar } from "@/components/ProgressBar";
import { StatTile } from "@/components/StatTile";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Hesab" };

export default async function AccountPage() {
  const user = await requireUser("/account");
  const profile = profileFromUser(user);
  const [courses, completed] = await Promise.all([
    listCourses(),
    getCompletedLessons(user.id),
  ]);
  const totalLessons = countLessons(courses);
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
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-wood-mist font-serif text-2xl font-semibold text-brand-wood dark:bg-white/10 dark:text-brand-brass-soft">
            {profile.fullName.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div>
          <h1 className="font-serif text-[clamp(1.8rem,3.4vw,2.5rem)] font-semibold leading-tight tracking-[-0.02em] text-ink dark:text-brand-cream">
            {profile.fullName}
          </h1>
          <p className="mt-1 text-sm text-ink/55 dark:text-white/55">
            {profile.email}
            {joined ? ` · Qeydiyyat: ${joined}` : ""}
          </p>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Kurslar" value={courses.length} />
        <StatTile label="Dərslər" value={totalLessons} />
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
                      className="font-serif text-lg font-semibold text-ink transition hover:text-brand-wood dark:text-brand-cream dark:hover:text-brand-brass-soft"
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

      <p className="mt-10 text-xs leading-5 text-ink/45 dark:text-white/45">
        Hesabınız Google vasitəsilə yaradılıb. Çıxış üçün yuxarıdakı
        &ldquo;Çıxış&rdquo; düyməsindən istifadə edin.
      </p>
    </main>
  );
}
