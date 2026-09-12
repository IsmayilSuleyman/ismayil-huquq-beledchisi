import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Comments from "@/components/gazette/Comments";
import DownloadButton from "@/components/gazette/DownloadButton";
import PdfViewerShell from "@/components/gazette/PdfViewerShell";
import RegisterRead from "@/components/gazette/RegisterRead";
import { formatBytes, formatDate, weekOf } from "@/lib/gazette/format";
import { getServerSupabase, publicUrl } from "@/lib/gazette/supabase";
import type { Issue } from "@/lib/gazette/types";

export const revalidate = 60;

type Params = { number: string };

async function getIssue(numberParam: string) {
  const issueNumber = Number(numberParam);
  if (!Number.isInteger(issueNumber) || issueNumber <= 0) return null;
  const supabase = getServerSupabase();
  const { data } = await supabase
    .from("issues")
    .select("*")
    .eq("issue_number", issueNumber)
    .maybeSingle();
  return (data as Issue | null) ?? null;
}

async function getNeighbors(issueNumber: number) {
  const supabase = getServerSupabase();
  const [prev, next] = await Promise.all([
    supabase
      .from("issues")
      .select("issue_number,title")
      .lt("issue_number", issueNumber)
      .order("issue_number", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("issues")
      .select("issue_number,title")
      .gt("issue_number", issueNumber)
      .order("issue_number", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);
  return {
    prev: prev.data as Pick<Issue, "issue_number" | "title"> | null,
    next: next.data as Pick<Issue, "issue_number" | "title"> | null,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { number } = await params;
  const issue = await getIssue(number);
  if (!issue) return { title: "Issue not found" };
  return {
    title: `Issue No. ${issue.issue_number} — ${issue.title}`,
    description: issue.summary ?? undefined,
  };
}

export default async function IssuePage({ params }: { params: Promise<Params> }) {
  const { number } = await params;
  const issue = await getIssue(number);
  if (!issue) notFound();

  const { prev, next } = await getNeighbors(issue.issue_number);
  const pdfUrl = publicUrl(issue.pdf_path);

  return (
    <div className="py-8 sm:py-10">
      {/* Counts one read each time the reading room opens */}
      <RegisterRead issueId={issue.id} />

      {/* Breadcrumb */}
      <nav className="mb-6 text-sm">
        <Link
          href="/gazette"
          className="inline-flex items-center gap-1.5 text-silver hover:text-white transition-colors"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="m14 6-6 6 6 6"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back to the library
        </Link>
      </nav>

      {/* Issue header */}
      <header className="olg-glass rounded-2xl p-6 sm:p-8 mb-6 olg-rise">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="olg-chip !bg-omni/70 !border-azure/45 !text-white font-medium">
            Issue No. {issue.issue_number}
          </span>
          <span className="text-xs text-silver">Week of {weekOf(issue.published_at)}</span>
        </div>
        <div className="mt-3.5 flex flex-wrap items-start justify-between gap-x-8 gap-y-5">
          <div className="max-w-3xl">
            <h1 className="font-serif text-3xl sm:text-4xl leading-tight">{issue.title}</h1>
            {issue.summary && (
              <p className="mt-3 text-foreground/65 leading-relaxed">{issue.summary}</p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-silver">
              <span>Published {formatDate(issue.published_at)}</span>
              {issue.page_count && <span>· {issue.page_count} pages</span>}
              {issue.file_size_bytes && <span>· {formatBytes(issue.file_size_bytes)}</span>}
              <span>· {issue.read_count.toLocaleString()} {issue.read_count === 1 ? "read" : "reads"}</span>
              {issue.download_count > 0 && <span>· {issue.download_count} downloads</span>}
              {issue.tags.map((t) => (
                <span key={t} className="olg-chip !py-0.5">
                  {t}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <DownloadButton
              issueId={issue.id}
              issueNumber={issue.issue_number}
              pdfUrl={pdfUrl}
            />
            <a href="#comments" className="olg-btn olg-btn-ghost">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M21 12a8 8 0 0 1-8 8H4l1.6-3.2A8 8 0 1 1 21 12Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
              Discussion
            </a>
          </div>
        </div>
      </header>

      {/* Reader */}
      <div className="olg-rise" style={{ animationDelay: "90ms" }}>
        <PdfViewerShell fileUrl={pdfUrl} issueId={issue.id} issueNumber={issue.issue_number} />
        <p className="hidden sm:block text-[0.7rem] text-silver text-center mt-3">
          Tip: click the viewer, then use ← → to flip pages and +/− to zoom.
        </p>
        <p className="sm:hidden text-[0.7rem] text-silver text-center mt-3">
          Tip: pinch with two fingers to zoom.
        </p>
      </div>

      {/* Prev / next */}
      {(prev || next) && (
        <nav className="grid sm:grid-cols-2 gap-4 mt-10">
          {prev ? (
            <Link
              href={`/gazette/issues/${prev.issue_number}`}
              className="olg-glass olg-glass-hover rounded-xl p-[1.125rem] flex items-center gap-3 group"
            >
              <span className="text-silver group-hover:text-azure transition-colors">←</span>
              <span className="min-w-0">
                <span className="block text-[0.65rem] uppercase tracking-[0.2em] text-silver">
                  Earlier · No. {prev.issue_number}
                </span>
                <span className="block text-sm truncate mt-0.5">{prev.title}</span>
              </span>
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link
              href={`/gazette/issues/${next.issue_number}`}
              className="olg-glass olg-glass-hover rounded-xl p-[1.125rem] flex items-center justify-end gap-3 text-right group sm:col-start-2"
            >
              <span className="min-w-0">
                <span className="block text-[0.65rem] uppercase tracking-[0.2em] text-silver">
                  Later · No. {next.issue_number}
                </span>
                <span className="block text-sm truncate mt-0.5">{next.title}</span>
              </span>
              <span className="text-silver group-hover:text-azure transition-colors">→</span>
            </Link>
          )}
        </nav>
      )}

      {/* Comments */}
      <div className="mt-10 max-w-4xl">
        <Comments issueId={issue.id} />
      </div>
    </div>
  );
}
