import Link from "next/link";
import { getSupabaseServerUser } from "@/lib/supabase/server";
import { listCourses, countLessons } from "@/lib/content";
import { listIssues } from "@/lib/gazette";
import { Wordmark } from "@/components/Wordmark";
import { MotionSection } from "@/components/MotionSection";

export const dynamic = "force-dynamic";

const FEATURES = [
  {
    title: "Ardıcıl dərslər",
    text: "Hər kurs mövzular üzrə ardıcıl qurulmuş dərslərdən ibarətdir. Mətnlər hüquqi terminologiyaya sadiq qalır.",
    soon: false,
    href: "/courses",
  },
  {
    title: "Omni Law Gazette",
    text: "Qanunvericilikdəki dəyişikliklərin həftəlik icmalı. Buraxılışlar oxu otağında açılır və yüklənə bilir.",
    soon: false,
    href: "/gazette",
  },
  {
    title: "Testlər",
    text: "Hər mövzunun sonunda biliklərinizi yoxlayan suallar və izahlı cavablar.",
    soon: true,
    href: null,
  },
  {
    title: "Süni intellekt köməkçisi",
    text: "Dərsin mətni əsasında suallarınıza cavab verən və misallarla izah edən köməkçi.",
    soon: true,
    href: null,
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

  return (
    <main className="min-h-screen px-3 py-3 sm:px-4 sm:py-4">
      <section className="relative mx-auto flex min-h-[calc(100vh-1.5rem)] w-full max-w-[1680px] flex-col items-center justify-center overflow-hidden rounded-hero border border-white/70 bg-[linear-gradient(135deg,rgba(255,252,247,0.9),rgba(246,239,227,0.94)_48%,rgba(236,225,207,0.96))] px-6 py-16 shadow-[0_28px_90px_rgba(62,42,31,0.10)] dark:border-white/10 dark:bg-none dark:bg-white/5 sm:min-h-[calc(100vh-2rem)] sm:rounded-[2.75rem] sm:px-10 lg:px-16">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(255,255,255,0.8),rgba(255,255,255,0)_32%),radial-gradient(circle_at_78%_14%,rgba(201,167,95,0.22),rgba(201,167,95,0)_26%),radial-gradient(circle_at_72%_76%,rgba(92,61,46,0.16),rgba(92,61,46,0)_30%)] dark:opacity-[0.12]"
        />
        <div
          aria-hidden
          className="absolute inset-4 rounded-3xl border border-white/50 bg-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] dark:bg-white/5 sm:inset-8 sm:rounded-hero"
        />

        <div className="relative flex w-full max-w-3xl flex-col items-center text-center">
          <Wordmark size="lg" />

          <h1 className="mt-10 font-serif text-[clamp(1.9rem,3.4vw,3rem)] font-semibold leading-[1.12] tracking-[-0.02em] text-ink dark:text-brand-cream">
            Hüququ ardıcıl, aydın və Azərbaycan dilində öyrənin.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-ink/60 dark:text-white/60">
            Hüquq anlayışlarından qanunvericiliyin quruluşuna qədər — hər mövzu
            hüquqi dildə, misallarla və özünüyoxlama sualları ilə izah olunur.
            İrəliləyişiniz Google hesabınızda saxlanılır.
          </p>

          {needsSetup ? (
            <p className="mt-6 max-w-md rounded-xl border border-brand-brass/30 bg-brand-wood-mist/70 px-4 py-3 text-xs leading-5 text-brand-wood dark:bg-white/10 dark:text-brand-brass-soft">
              Supabase mühit dəyişənləri hələ əlavə edilməyib. Onlar
              qurulduqdan sonra Google ilə giriş aktiv olacaq.
            </p>
          ) : null}

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
            {user ? (
              <Link
                href="/courses"
                className="rounded-xl bg-brand-wood px-6 py-3.5 text-sm font-medium uppercase tracking-[0.16em] text-brand-cream shadow-glass-wood transition hover:-translate-y-0.5 hover:bg-brand-wood-deep"
              >
                Kurslara keçin
              </Link>
            ) : (
              <Link
                href="/login"
                className="rounded-xl bg-brand-wood px-6 py-3.5 text-sm font-medium uppercase tracking-[0.16em] text-brand-cream shadow-glass-wood transition hover:-translate-y-0.5 hover:bg-brand-wood-deep"
              >
                Google ilə daxil olun
              </Link>
            )}
            <span className="text-xs uppercase tracking-[0.18em] text-ink/45 dark:text-white/45">
              {courses.length} kurs · {lessonCount} dərs
              {issues.length > 0 ? ` · ${issues.length} qəzet buraxılışı` : ""}
            </span>
          </div>
        </div>

        <MotionSection
          delay={0.15}
          className="relative mt-14 grid w-full max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {FEATURES.map((f) => {
            const body = (
              <>
                {f.soon ? (
                  <span className="mb-3 inline-block rounded-full border border-brand-brass/40 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-brand-brass">
                    Tezliklə
                  </span>
                ) : null}
                <h2 className="font-serif text-lg font-semibold leading-snug text-ink dark:text-brand-cream">
                  {f.title}
                </h2>
                <p className="mt-3 text-sm leading-6 text-ink/55 dark:text-white/55">
                  {f.text}
                </p>
              </>
            );
            return f.href ? (
              <Link
                key={f.title}
                href={f.href}
                className="glass p-6 text-left transition hover:-translate-y-0.5 hover:shadow-glass-wood"
              >
                {body}
              </Link>
            ) : (
              <div key={f.title} className="glass p-6 text-left">
                {body}
              </div>
            );
          })}
        </MotionSection>
      </section>
    </main>
  );
}
