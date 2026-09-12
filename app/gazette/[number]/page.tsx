import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSupabaseServerUser } from "@/lib/supabase/server";
import { getIssue, getNeighbors } from "@/lib/gazette";
import { isGazetteEditor } from "@/lib/gazette-editor";
import { formatBytes, formatDate, weekOf } from "@/lib/gazette-format";
import { profileFromUser } from "@/lib/user";
import { AppHeader } from "@/components/AppHeader";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Comments } from "@/components/gazette/Comments";
import { DownloadButton } from "@/components/gazette/DownloadButton";
import { PdfViewerShell } from "@/components/gazette/PdfViewerShell";
import { RegisterRead } from "@/components/gazette/RegisterRead";

export const dynamic = "force-dynamic";

type Params = Promise<{ number: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { number } = await params;
  const issue = await getIssue(number);
  if (!issue) return { title: "Buraxılış tapılmadı" };
  return {
    title: `№ ${issue.issue_number} — ${issue.title} · Omni Law Gazette`,
    description: issue.summary ?? undefined,
    };
}

export default async function IssuePage({ params }: { params: Params }) {
  const { number } = await params;
  const [{ user }, issue] = await Promise.all([getSupabaseServerUser(), getIssue(number)]);
  if (!issue) notFound();

  const profile = user ? profileFromUser(user) : null;
  const [editor, { prev, next }] = await Promise.all([
    user ? isGazetteEditor(user.email) : Promise.resolve(false),
    getNeighbors(issue.issue_number),
  ]);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 pb-16">
      <AppHeader name={profile?.firstName} avatarUrl={profile?.avatarUrl ?? null} />
      {/* Counts one read each time the reading room opens */}
      <RegisterRead issueId={issue.id} />

      <Breadcrumbs
        items={[
          { href: "/gazette", label: "Qəzet" },
          { label: `№ ${issue.issue_number}` },
        ]}
      />

      {/* Issue header */}
      <header className="glass rise mb-6 p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="chip chip-solid">Buraxılış № {issue.issue_number}</span>
          <span className="text-xs text-ink/45 dark:text-white/45">{weekOf(issue.published_at)} həftəsi</span>
        </div>
        <div className="mt-3.5 flex flex-wrap items-start justify-between gap-x-8 gap-y-5">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-semibold leading-tight text-ink dark:text-brand-cream sm:text-4xl">
              {issue.title}
            </h1>
            {issue.summary && (
              <p className="mt-3 leading-relaxed text-ink/60 dark:text-white/60">{issue.summary}</p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink/45 dark:text-white/45">
              <span>Nəşr: {formatDate(issue.published_at)}</span>
              {issue.page_count && <span className="num">· {issue.page_count} səhifə</span>}
              {issue.file_size_bytes && <span className="num">· {formatBytes(issue.file_size_bytes)}</span>}
              <span className="num">· {issue.read_count.toLocaleString("az-AZ")} oxunma</span>
              {issue.download_count > 0 && <span className="num">· {issue.download_count} yükləmə</span>}
              {issue.tags.map((t) => (
                <span key={t} className="chip !py-0.5">
                  {t}
                </span>
              ))}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            <DownloadButton issueId={issue.id} issueNumber={issue.issue_number} pdfUrl={issue.pdfUrl} />
            <a href="#comments" className="btn btn-ghost">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M21 12a8 8 0 0 1-8 8H4l1.6-3.2A8 8 0 1 1 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              </svg>
              Müzakirə
            </a>
          </div>
        </div>
      </header>

      {/* Reader */}
      <div className="rise" style={{ animationDelay: "90ms" }}>
        <PdfViewerShell fileUrl={issue.pdfUrl} issueId={issue.id} issueNumber={issue.issue_number} />
        <p className="mt-3 hidden text-center text-[11px] text-ink/45 dark:text-white/45 sm:block">
          Məsləhət: oxuyucuya klikləyin, sonra ← → ilə səhifələri çevirin, +/− ilə böyüdün.
        </p>
        <p className="mt-3 text-center text-[11px] text-ink/45 dark:text-white/45 sm:hidden">
          Məsləhət: böyütmək üçün iki barmaqla sıxın.
        </p>
      </div>

      {/* Prev / next */}
      {(prev || next) && (
        <nav className="mt-10 grid gap-4 sm:grid-cols-2" aria-label="Buraxılışlar arasında keçid">
          {prev ? (
            <Link
              href={`/gazette/${prev.issue_number}`}
              className="glass group flex items-center gap-3 p-[1.125rem] transition hover:-translate-y-0.5 hover:shadow-glass-wood"
            >
              <span className="text-ink/45 transition-colors group-hover:text-brand-brass dark:text-white/45">←</span>
              <span className="min-w-0">
                <span className="block text-[10px] uppercase tracking-[0.2em] text-ink/45 dark:text-white/45">
                  Əvvəlki · № {prev.issue_number}
                </span>
                <span className="mt-0.5 block truncate text-sm text-ink dark:text-white/90">{prev.title}</span>
              </span>
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link
              href={`/gazette/${next.issue_number}`}
              className="glass group flex items-center justify-end gap-3 p-[1.125rem] text-right transition hover:-translate-y-0.5 hover:shadow-glass-wood sm:col-start-2"
            >
              <span className="min-w-0">
                <span className="block text-[10px] uppercase tracking-[0.2em] text-ink/45 dark:text-white/45">
                  Növbəti · № {next.issue_number}
                </span>
                <span className="mt-0.5 block truncate text-sm text-ink dark:text-white/90">{next.title}</span>
              </span>
              <span className="text-ink/45 transition-colors group-hover:text-brand-brass dark:text-white/45">→</span>
            </Link>
          )}
        </nav>
      )}

      {/* Comments */}
      <div className="mt-10 max-w-4xl">
        <Comments issueId={issue.id} defaultName={profile?.fullName ?? ""} canModerate={editor} />
      </div>
    </main>
  );
}
