import Image from "next/image";
import Link from "next/link";
import DownloadButton from "@/components/gazette/DownloadButton";
import LibraryExplorer from "@/components/gazette/LibraryExplorer";
import type { IssueWithUrls } from "@/components/gazette/IssueCard";
import { formatDate, weekOf } from "@/lib/gazette/format";
import { getServerSupabase, publicUrl } from "@/lib/gazette/supabase";
import type { Issue } from "@/lib/gazette/types";

export const revalidate = 60;

async function getIssues(): Promise<IssueWithUrls[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("issues")
    .select("*")
    .order("issue_number", { ascending: false });
  if (error) {
    // A paused or unreachable database must not fail the build: render the
    // empty library and let the 60 s revalidation retry.
    console.error(`Failed to load issues: ${error.message}`);
    return [];
  }
  return (data as Issue[]).map((issue) => ({
    ...issue,
    coverUrl: issue.cover_path ? publicUrl(issue.cover_path) : null,
    pdfUrl: publicUrl(issue.pdf_path),
  }));
}

export default async function LibraryPage() {
  const issues = await getIssues();
  const latest = issues[0];
  const totalReads = issues.reduce((sum, i) => sum + i.read_count, 0);
  const totalDownloads = issues.reduce((sum, i) => sum + i.download_count, 0);
  const firstYear = issues.length
    ? Math.min(...issues.map((i) => Number(i.published_at.slice(0, 4))))
    : new Date().getFullYear();

  return (
    <div className="py-12 sm:py-16">
      {/* ---------- Masthead ---------- */}
      <section className="text-center max-w-3xl mx-auto olg-rise">
        <p className="olg-eyebrow mb-5">Omni Law Firm · Internal Library</p>
        <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl leading-[1.04] tracking-tight">
          The Law <span className="italic text-azure-soft">Gazette</span>
        </h1>
        <p className="mt-5 text-foreground/65 text-base sm:text-lg leading-relaxed">
          Your weekly digest of legislative developments — curated by the legal desk, archived
          here like a library. New issue every week.
        </p>
        {issues.length > 0 && (
          <div className="mt-7 flex items-center justify-center gap-2.5 flex-wrap">
            <span className="olg-chip">
              {issues.length} issue{issues.length === 1 ? "" : "s"} archived
            </span>
            <span className="olg-chip">Since {firstYear}</span>
            {latest && <span className="olg-chip">Latest · {formatDate(latest.published_at)}</span>}
            {totalReads > 0 && (
              <span className="olg-chip">{totalReads.toLocaleString()} reads</span>
            )}
            {totalDownloads > 0 && <span className="olg-chip">{totalDownloads} downloads</span>}
          </div>
        )}
      </section>

      {/* ---------- Featured latest issue ---------- */}
      {latest ? (
        <section className="mt-14 olg-rise" style={{ animationDelay: "120ms" }}>
          <div className="olg-glass-deep rounded-3xl overflow-hidden md:grid md:grid-cols-[280px_1fr] lg:grid-cols-[320px_1fr]">
            <Link
              href={`/gazette/issues/${latest.issue_number}`}
              className="relative block aspect-[5/6] md:aspect-auto md:h-full min-h-[260px] group overflow-hidden"
              aria-label={`Read the latest issue: ${latest.title}`}
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
                <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-omni/60 via-omni-ink to-omni-ink">
                  <span className="font-serif text-7xl text-white/25">№{latest.issue_number}</span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#05080f]/70 via-transparent to-transparent md:bg-gradient-to-r" />
            </Link>

            <div className="p-7 sm:p-10 flex flex-col justify-center">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="olg-chip !bg-omni/70 !border-azure/45 !text-white font-medium">
                  ● Latest issue
                </span>
                <span className="text-xs text-silver tracking-wide">
                  No. {latest.issue_number} · week of {weekOf(latest.published_at)}
                </span>
              </div>
              <h2 className="mt-4 font-serif text-2xl sm:text-[2.1rem] leading-tight">
                {latest.title}
              </h2>
              {latest.summary && (
                <p className="mt-3.5 text-foreground/65 leading-relaxed line-clamp-3">
                  {latest.summary}
                </p>
              )}
              <div className="mt-4 flex items-center gap-3.5 text-xs text-silver flex-wrap">
                <span>{formatDate(latest.published_at)}</span>
                {latest.page_count && <span>· {latest.page_count} pages</span>}
                {latest.tags.slice(0, 4).map((t) => (
                  <span key={t} className="olg-chip !py-1">
                    {t}
                  </span>
                ))}
              </div>
              <div className="mt-7 flex items-center gap-3 flex-wrap">
                <Link href={`/gazette/issues/${latest.issue_number}`} className="olg-btn olg-btn-primary">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                  </svg>
                  Read this issue
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
          <div className="olg-glass rounded-3xl p-12 text-center max-w-xl mx-auto">
            <p className="font-serif text-2xl mb-2">The library is ready.</p>
            <p className="text-foreground/60 text-sm leading-relaxed">
              No issues have been published yet. Head to the{" "}
              <Link href="/gazette/admin" className="text-azure hover:underline">
                admin desk
              </Link>{" "}
              to publish the first weekly issue — it will appear here instantly.
            </p>
          </div>
        </section>
      )}

      {/* ---------- Library grid ---------- */}
      {issues.length > 0 && (
        <section className="mt-16">
          <div className="flex items-end justify-between gap-4 mb-7">
            <div>
              <p className="olg-eyebrow mb-2">Archive</p>
              <h2 className="font-serif text-3xl sm:text-4xl">Browse the library</h2>
            </div>
          </div>
          <LibraryExplorer issues={issues} />
        </section>
      )}
    </div>
  );
}
