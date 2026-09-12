import Image from "next/image";
import Link from "next/link";
import { getSupabaseServerUser } from "@/lib/supabase/server";
import { listCourses, countLessons } from "@/lib/content";
import { GAZETTE_URL, issueUrl, listIssues } from "@/lib/gazette";
import { formatDate } from "@/lib/gazette-format";
import { Wordmark } from "@/components/Wordmark";
import { MotionSection } from "@/components/MotionSection";
import { ProgressBar } from "@/components/ProgressBar";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    title: "Google ilə daxil olun",
    text: "Ayrıca qeydiyyat yoxdur. Google hesabınız kifayətdir; irəliləyişiniz ona bağlanır.",
  },
  {
    title: "Kursu seçin, dərsləri ardıcıl keçin",
    text: "Hər dərs hüquqi dildə yazılıb, misallar, əsas terminlər və özünüyoxlama sualları ilə bitir.",
  },
  {
    title: "Qanunvericilikdən xəbərdar qalın",
    text: "Omni Law Gazette hər həftə qanunvericilikdəki dəyişikliklərin icmalını dərc edir.",
  },
];

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ setup?: string }>;
}) {
  const [{ setup }, { user, reason }, courses, issues] = await Promise.all([
    searchParams,
    getSupabaseServerUser(),
    listCourses(),
    listIssues(),
  ]);
  const needsSetup = setup === "supabase" || reason === "missing_config";
  const lessonCount = countLessons(courses);
  const featured = courses[0] ?? null;
  const latest = issues[0] ?? null;
  const primaryHref = user ? "/courses" : "/login";
  const primaryLabel = user ? "Kurslara keçin" : "Google ilə daxil olun";

  return (
    <main className="mx-auto w-full max-w-6xl px-6 pb-16">
      {/* Top bar */}
      <header className="flex items-center justify-between gap-4 py-6">
        <Link href="/" aria-label="Ana səhifə">
          <Wordmark size="sm" />
        </Link>
        <nav className="flex items-center gap-3 sm:gap-6" aria-label="Əsas keçidlər">
          <Link
            href={GAZETTE_URL}
            className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-ink/55 transition hover:text-brand-wood dark:text-white/55 dark:hover:text-brand-brass-soft sm:inline"
          >
            Qəzet
          </Link>
          <Link
            href="/courses"
            className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-ink/55 transition hover:text-brand-wood dark:text-white/55 dark:hover:text-brand-brass-soft sm:inline"
          >
            Kurslar
          </Link>
          <Link
            href={primaryHref}
            className="rounded-lg bg-brand-wood px-3.5 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-cream transition hover:-translate-y-px hover:bg-brand-wood-deep"
          >
            {user ? "Hesabım" : "Daxil olun"}
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="glass-strong relative mt-4 overflow-hidden rounded-hero px-6 py-10 sm:px-10 sm:py-14 lg:px-14">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(circle_at_12%_10%,rgba(255,255,255,0.75),rgba(255,255,255,0)_30%),radial-gradient(circle_at_85%_20%,rgba(201,167,95,0.22),rgba(201,167,95,0)_28%),radial-gradient(circle_at_70%_90%,rgba(92,61,46,0.16),rgba(92,61,46,0)_30%)] dark:opacity-[0.14]"
        />
        <div className="relative grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-center">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-brand-brass">
              Hüquq təhsili platforması
            </p>
            <h1 className="mt-4 text-[clamp(2rem,4.2vw,3.4rem)] font-bold leading-[1.08] tracking-[-0.025em] text-ink dark:text-brand-cream">
              Hüququ ardıcıl, aydın və Azərbaycan dilində öyrənin.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-ink/60 dark:text-white/60">
              Hüquq anlayışlarından qanunvericiliyin quruluşuna qədər hər mövzu
              hüquqi dildə, misallarla və özünüyoxlama sualları ilə izah olunur.
              İrəliləyişiniz Google hesabınızda saxlanılır.
            </p>

            {needsSetup ? (
              <p className="mt-5 max-w-md rounded-xl border border-brand-brass/30 bg-brand-wood-mist/70 px-4 py-3 text-xs leading-5 text-brand-wood dark:bg-white/10 dark:text-brand-brass-soft">
                Supabase mühit dəyişənləri hələ əlavə edilməyib. Onlar
                qurulduqdan sonra Google ilə giriş aktiv olacaq.
              </p>
            ) : null}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href={primaryHref} className="btn btn-primary !px-6 !py-3.5">
                {primaryLabel}
              </Link>
              <Link href={GAZETTE_URL} className="btn btn-ghost !px-6 !py-3.5">
                Qəzeti oxuyun
              </Link>
            </div>

            <dl className="mt-10 grid max-w-md grid-cols-3 gap-4 border-t border-brand-wood-ring/70 pt-6 dark:border-white/10">
              {[
                [courses.length, "Kurs"],
                [lessonCount, "Dərs"],
                [issues.length, "Qəzet buraxılışı"],
              ].map(([value, label]) => (
                <div key={String(label)}>
                  <dt className="text-[10px] uppercase tracking-[0.2em] text-ink/45 dark:text-white/45">
                    {label}
                  </dt>
                  <dd className="num mt-1 text-2xl font-bold text-ink dark:text-brand-cream">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Course preview card — real data from the first course */}
          {featured ? (
            <div className="glass relative min-w-0 p-6 sm:p-7">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-brass">
                  Kursun içindən
                </span>
                {featured.level ? <span className="chip">{featured.level}</span> : null}
              </div>
              <h2 className="mt-3 text-2xl font-bold leading-snug tracking-[-0.02em] text-ink dark:text-brand-cream">
                {featured.title}
              </h2>
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-ink/55 dark:text-white/55">
                {featured.description}
              </p>
              <ol className="mt-5 divide-y divide-brand-wood-ring/60 border-y border-brand-wood-ring/60 dark:divide-white/10 dark:border-white/10">
                {featured.lessons.slice(0, 3).map((lesson, i) => (
                  <li key={lesson.slug} className="flex items-center gap-3 py-3">
                    <span className="num flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-wood-mist text-[11px] font-semibold text-brand-wood dark:bg-white/10 dark:text-brand-brass-soft">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink dark:text-white/90">
                      {lesson.title}
                    </span>
                    {lesson.minutes ? (
                      <span className="num shrink-0 text-[11px] uppercase tracking-[0.16em] text-ink/45 dark:text-white/45">
                        {lesson.minutes} dəq
                      </span>
                    ) : null}
                  </li>
                ))}
              </ol>
              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-ink/45 dark:text-white/45">
                  <span>İrəliləyiş</span>
                  <span className="num">0/{featured.lessons.length}</span>
                </div>
                <ProgressBar percent={0} />
              </div>
              <Link
                href={user ? `/courses/${featured.slug}` : "/login"}
                className="mt-5 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-wood transition hover:text-brand-wood-deep dark:text-brand-brass-soft dark:hover:text-brand-cream"
              >
                Kursa başlayın
                <span aria-hidden>→</span>
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      {/* Latest gazette issue */}
      {latest ? (
        <MotionSection className="mt-8">
          <div className="glass overflow-hidden md:grid md:grid-cols-[200px_minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)]">
            <Link
              href={issueUrl(latest.issue_number)}
              className="group relative block aspect-[5/6] min-h-[200px] overflow-hidden md:aspect-auto md:h-full"
              aria-label={`Sonuncu buraxılışı oxu: ${latest.title}`}
            >
              {latest.coverUrl ? (
                <Image
                  src={latest.coverUrl}
                  alt=""
                  fill
                  sizes="(max-width: 768px) 100vw, 240px"
                  className="object-cover object-top transition-transform duration-700 group-hover:scale-[1.04]"
                />
              ) : (
                <div className="absolute inset-0 grid place-items-center bg-brand-wood-deep">
                  <span className="text-6xl font-bold text-white/25">№{latest.issue_number}</span>
                </div>
              )}
            </Link>
            <div className="flex min-w-0 flex-col justify-center p-6 sm:p-8">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-brass">
                Omni Law Gazette · Sonuncu buraxılış
              </p>
              <h2 className="mt-3 text-xl font-bold leading-snug tracking-[-0.02em] text-ink dark:text-brand-cream sm:text-2xl">
                {latest.title}
              </h2>
              <p className="num mt-2 text-sm text-ink/55 dark:text-white/55">
                № {latest.issue_number} · {formatDate(latest.published_at)}
                {latest.page_count ? ` · ${latest.page_count} səhifə` : ""}
              </p>
              {latest.summary ? (
                <p className="mt-3 line-clamp-2 text-sm leading-6 text-ink/60 dark:text-white/60">
                  {latest.summary}
                </p>
              ) : null}
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href={issueUrl(latest.issue_number)} className="btn btn-primary">
                  Buraxılışı oxu
                </Link>
                <Link href={GAZETTE_URL} className="btn btn-ghost">
                  Bütün buraxılışlar ({issues.length})
                </Link>
              </div>
            </div>
          </div>
        </MotionSection>
      ) : null}

      {/* How it works */}
      <MotionSection delay={0.05} className="mt-16">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-brass">
          Necə işləyir
        </p>
        <h2 className="text-3xl font-bold tracking-[-0.02em] text-ink dark:text-brand-cream">
          Üç addımda
        </h2>
        <ol className="mt-8 grid gap-5 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="glass-tinted p-6">
              <span className="num text-3xl font-bold text-brand-brass">0{i + 1}</span>
              <h3 className="mt-3 text-base font-bold text-ink dark:text-brand-cream">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-ink/55 dark:text-white/55">{step.text}</p>
            </li>
          ))}
        </ol>
      </MotionSection>

      {/* Closing call to action */}
      <MotionSection delay={0.05} className="mt-16">
        <div className="glass-strong flex flex-col items-center gap-5 rounded-hero px-6 py-12 text-center sm:px-10">
          <Wordmark size="md" />
          <p className="max-w-lg text-sm leading-6 text-ink/60 dark:text-white/60">
            Hüquq təhsilinə bu gün başlayın. Giriş pulsuzdur; hesab Google ilə bir
            kliklə yaranır.
          </p>
          <Link href={primaryHref} className="btn btn-primary !px-7 !py-3.5">
            {primaryLabel}
          </Link>
        </div>
      </MotionSection>

      <footer className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-brand-wood-ring/70 pt-6 text-[11px] text-ink/45 dark:border-white/10 dark:text-white/45 sm:flex-row">
        <p>© {new Date().getFullYear()} İsmayıl Hüquq Bələdçisi · Omni Law Gazette</p>
        <nav className="flex gap-5 uppercase tracking-[0.16em]" aria-label="Alt keçidlər">
          <Link href="/courses" className="transition hover:text-brand-wood dark:hover:text-brand-brass-soft">Kurslar</Link>
          <Link href={GAZETTE_URL} className="transition hover:text-brand-wood dark:hover:text-brand-brass-soft">Qəzet</Link>
          <Link href="/login" className="transition hover:text-brand-wood dark:hover:text-brand-brass-soft">Daxil olun</Link>
        </nav>
      </footer>
    </main>
  );
}
