import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { getSupabaseServerUser } from "@/lib/supabase/server";
import { listIssues } from "@/lib/gazette";
import { isGazetteEditor } from "@/lib/gazette-editor";
import { formatDate, weekOf } from "@/lib/gazette-format";
import { profileFromUser } from "@/lib/user";
import { AppHeader } from "@/components/AppHeader";
import { DownloadButton } from "@/components/gazette/DownloadButton";
import { LibraryExplorer } from "@/components/gazette/LibraryExplorer";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Omni Law Gazette",
  description: "Qanunvericilikdəki dəyişikliklərin həftəlik icmalı — bütün buraxılışların kitabxanası.",
};

export default async function GazettePage() {
  const [{ user }, issues] = await Promise.all([getSupabaseServerUser(), listIssues()]);
  const profile = user ? profileFromUser(user) : null;
  const editor = user ? await isGazetteEditor(user.email) : false;

  const latest = issues[0];
  const totalReads = issues.reduce((sum, i) => sum + i.read_count, 0);
  const totalDownloads = issues.reduce((sum, i) => sum + i.download_count, 0);
  const firstYear = issues.length
    ? Math.min(...issues.map((i) => Number(i.published_at.slice(0, 4))))
    : new Date().getFullYear();

  return (
    <main className="mx-auto w-full max-w-6xl px-6 pb-16">
      <AppHeader name={profile?.firstName} avatarUrl={profile?.avatarUrl ?? null} />

      {/* Masthead */}
      <section className="rise mx-auto max-w-3xl text-center">
        <p className="mb-5 text-[10px] font-semibold uppercase tracking-[0.3em] text-brand-brass">
          Omni Law Firm · Həftəlik qanunvericilik icmalı
        </p>
        <h1 className="font-serif text-[clamp(2.4rem,6vw,4.4rem)] font-semibold leading-[1.04] tracking-tight text-ink dark:text-brand-cream">
          Omni Law <span className="italic text-brand-wood dark:text-brand-brass-soft">Gazette</span>
        </h1>
        <p className="mt-5 text-base leading-relaxed text-ink/60 dark:text-white/60 sm:text-lg">
          Qanunvericilikdəki dəyişikliklərin həftəlik icmalı. Hər buraxılış PDF
          formatında oxu otağında açılır və yüklənə bilir.
        </p>
        {issues.length > 0 && (
          <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
            <span className="chip num">{issues.length} buraxılış</span>
            <span className="chip num">{firstYear}-cı ildən</span>
            {latest && <span className="chip">Sonuncu · {formatDate(latest.published_at)}</span>}
            {totalReads > 0 && <span className="chip num">{totalReads.toLocaleString("az-AZ")} oxunma</span>}
            {totalDownloads > 0 && <span className="chip num">{totalDownloads} yükləmə</span>}
          </div>
        )}
        {editor && (
          <p className="mt-5">
            <Link href="/gazette/admin" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-brass transition hover:text-brand-wood dark:hover:text-brand-cream">
              Redaktor masası →
            </Link>
          </p>
        )}
      </section>

      {/* Featured latest issue */}
      {latest ? (
        <section className="rise mt-14" style={{ animationDelay: "120ms" }}>
          <div className="glass-strong overflow-hidden rounded-hero md:grid md:grid-cols-[280px_1fr] lg:grid-cols-[320px_1fr]">
            <Link
              href={`/gazette/${latest.issue_number}`}
              className="group relative block aspect-[5/6] min-h-[260px] overflow-hidden md:aspect-auto md:h-full"
              aria-label={`Sonuncu buraxılışı oxu: ${latest.title}`}
            >
              {latest.coverUrl ? (
                <Image
                  src={latest.coverUrl}
                  alt=""
                  fill
                  priority
                  sizes="(max-width: 768px) 100vw, 320px"
                  className="object-cover object-top transition-transform duration-700 group-hover:scale-[1.04]"
                />
              ) : (
                <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-brand-wood/50 via-brand-wood-deep to-brand-wood-deep">
                  <span className="font-serif text-7xl text-white/25">№{latest.issue_number}</span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#1c1410]/60 via-transparent to-transparent md:bg-gradient-to-r" />
            </Link>

            <div className="flex flex-col justify-center p-7 sm:p-10">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="chip chip-solid">● Sonuncu buraxılış</span>
                <span className="num text-xs tracking-wide text-ink/45 dark:text-white/45">
                  № {latest.issue_number} · {weekOf(latest.published_at)} həftəsi
                </span>
              </div>
              <h2 className="mt-4 font-serif text-2xl font-semibold leading-tight text-ink dark:text-brand-cream sm:text-[2.1rem]">
                {latest.title}
              </h2>
              {latest.summary && (
                <p className="mt-3.5 line-clamp-3 leading-relaxed text-ink/60 dark:text-white/60">
                  {latest.summary}
                </p>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-3.5 text-xs text-ink/45 dark:text-white/45">
                <span>{formatDate(latest.published_at)}</span>
                {latest.page_count && <span className="num">· {latest.page_count} səhifə</span>}
                {latest.tags.slice(0, 4).map((t) => (
                  <span key={t} className="chip !py-1">
                    {t}
                  </span>
                ))}
              </div>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link href={`/gazette/${latest.issue_number}`} className="btn btn-primary">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" stroke="currentColor" strokeWidth="2" />
                    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                  </svg>
                  Buraxılışı oxu
                </Link>
                <DownloadButton
                  issueId={latest.id}
                  issueNumber={latest.issue_number}
                  pdfUrl={latest.pdfUrl}
                  variant="ghost"
                />
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="mt-14">
          <div className="glass mx-auto max-w-xl p-12 text-center">
            <p className="mb-2 font-serif text-2xl text-ink dark:text-brand-cream">Kitabxana hazırdır.</p>
            <p className="text-sm leading-relaxed text-ink/55 dark:text-white/55">
              Hələ heç bir buraxılış nəşr olunmayıb.
              {editor ? (
                <>
                  {" "}
                  İlk buraxılışı{" "}
                  <Link href="/gazette/admin" className="text-brand-brass hover:underline">
                    redaktor masasından
                  </Link>{" "}
                  əlavə edin.
                </>
              ) : null}
            </p>
          </div>
        </section>
      )}

      {/* Library grid */}
      {issues.length > 0 && (
        <section className="mt-16">
          <div className="mb-7 flex items-end justify-between gap-4">
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-brass">
                Arxiv
              </p>
              <h2 className="font-serif text-3xl font-semibold text-ink dark:text-brand-cream sm:text-4xl">
                Kitabxanaya baxın
              </h2>
            </div>
          </div>
          <LibraryExplorer issues={issues} />
        </section>
      )}
    </main>
  );
}
