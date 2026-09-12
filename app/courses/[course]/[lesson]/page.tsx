import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth-guard";
import { getLesson } from "@/lib/content";
import { getCompletedLessons, progressKey } from "@/lib/progress";
import { profileFromUser } from "@/lib/user";
import { AppHeader } from "@/components/AppHeader";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CompleteToggle } from "@/components/CompleteToggle";
import { LessonBody } from "@/components/LessonBody";

export const dynamic = "force-dynamic";

type Params = Promise<{ course: string; lesson: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { course, lesson } = await params;
  const page = await getLesson(course, lesson);
  return { title: page ? `${page.lesson.title} · ${page.course.title}` : "Dərs" };
}

export default async function LessonPage({ params }: { params: Params }) {
  const { course: courseSlug, lesson: lessonSlug } = await params;
  const user = await requireUser(`/courses/${courseSlug}/${lessonSlug}`);
  const profile = profileFromUser(user);
  const [page, completed] = await Promise.all([
    getLesson(courseSlug, lessonSlug),
    getCompletedLessons(user.id),
  ]);
  if (!page) notFound();

  const { course, lesson, prev, next } = page;
  const index = course.lessons.findIndex((l) => l.slug === lesson.slug);
  const isDone = completed.has(progressKey(course.slug, lesson.slug));

  return (
    <main className="mx-auto w-full max-w-5xl px-6 pb-16">
      <AppHeader name={profile.firstName} avatarUrl={profile.avatarUrl} />
      <Breadcrumbs
        items={[
          { href: "/courses", label: "Kurslar" },
          { href: `/courses/${course.slug}`, label: course.title },
          { label: `Dərs ${index + 1}` },
        ]}
      />

      <article className="mx-auto max-w-3xl">
        <header className="mb-10">
          <div className="flex flex-wrap items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-brass">
            <span className="num">
              Dərs {index + 1} / {course.lessons.length}
            </span>
            {lesson.minutes ? (
              <>
                <span aria-hidden className="text-brand-wood-ring">·</span>
                <span className="num">{lesson.minutes} dəqiqə</span>
              </>
            ) : null}
            {isDone ? (
              <>
                <span aria-hidden className="text-brand-wood-ring">·</span>
                <span className="text-status-done dark:text-brand-brass-soft">Tamamlanıb</span>
              </>
            ) : null}
          </div>
          <h1 className="mt-4 font-serif text-[clamp(1.9rem,3.6vw,2.7rem)] font-semibold leading-tight tracking-[-0.02em] text-ink dark:text-brand-cream">
            {lesson.title}
          </h1>
          {lesson.summary ? (
            <p className="mt-4 text-base leading-7 text-ink/60 dark:text-white/60">
              {lesson.summary}
            </p>
          ) : null}
        </header>

        <div className="glass-strong px-6 py-8 sm:px-10 sm:py-12">
          <LessonBody source={lesson.body} />
        </div>

        <div className="mt-10 flex flex-col items-start gap-6 border-t border-brand-wood-ring/70 pt-8 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
          <CompleteToggle
            courseSlug={course.slug}
            lessonSlug={lesson.slug}
            initialCompleted={isDone}
          />
          <Link
            href={`/courses/${course.slug}`}
            className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink/45 transition hover:text-brand-wood dark:text-white/45 dark:hover:text-brand-brass-soft"
          >
            Kursun mündəricatı
          </Link>
        </div>

        <nav aria-label="Dərslər arasında keçid" className="mt-8 grid gap-4 sm:grid-cols-2">
          {prev ? (
            <Link
              href={`/courses/${course.slug}/${prev.slug}`}
              className="glass group p-5 transition hover:-translate-y-0.5 hover:shadow-glass-wood"
            >
              <span className="text-[10px] uppercase tracking-[0.2em] text-ink/45 dark:text-white/45">
                Əvvəlki dərs
              </span>
              <span className="mt-2 block font-serif text-lg font-semibold leading-snug text-ink transition group-hover:text-brand-wood dark:text-brand-cream dark:group-hover:text-brand-brass-soft">
                {prev.title}
              </span>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link
              href={`/courses/${course.slug}/${next.slug}`}
              className="glass group p-5 text-right transition hover:-translate-y-0.5 hover:shadow-glass-wood"
            >
              <span className="text-[10px] uppercase tracking-[0.2em] text-ink/45 dark:text-white/45">
                Növbəti dərs
              </span>
              <span className="mt-2 block font-serif text-lg font-semibold leading-snug text-ink transition group-hover:text-brand-wood dark:text-brand-cream dark:group-hover:text-brand-brass-soft">
                {next.title}
              </span>
            </Link>
          ) : (
            <Link
              href={`/courses/${course.slug}`}
              className="glass-tinted group p-5 text-right transition hover:-translate-y-0.5"
            >
              <span className="text-[10px] uppercase tracking-[0.2em] text-ink/45 dark:text-white/45">
                Kursun sonu
              </span>
              <span className="mt-2 block font-serif text-lg font-semibold leading-snug text-ink dark:text-brand-cream">
                Mündəricata qayıdın
              </span>
            </Link>
          )}
        </nav>
      </article>
    </main>
  );
}
