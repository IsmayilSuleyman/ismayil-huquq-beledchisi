import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SummaryBody from "@/components/gazette/SummaryBody";
import SummaryDownloadButton from "@/components/gazette/SummaryDownloadButton";
import { formatBytes, formatDate } from "@/lib/gazette/format";
import { getSummary, kindLabel, summaryHeading } from "@/lib/gazette/summaries";

export const revalidate = 60;

type Params = { id: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const summary = await getSummary((await params).id);
  if (!summary) return { title: "Summary not found" };
  return { title: `${summaryHeading(summary, formatDate)} · ${summary.topic}`, description: summary.title };
}

export default async function SummaryPage({ params }: { params: Promise<Params> }) {
  const summary = await getSummary((await params).id);
  if (!summary) notFound();

  const bullets = summary.body.reduce((n, b) => n + b.bullets.length, 0);

  return (
    <div className="py-8 sm:py-10">
      <nav className="mb-6 text-sm">
        <Link href="/summaries" className="inline-flex items-center gap-1.5 text-silver hover:text-foreground transition-colors">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="m14 6-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to the summaries
        </Link>
      </nav>

      <header className="olg-glass rounded-2xl p-6 sm:p-8 mb-6 olg-rise">
        <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-5">
          <div className="max-w-3xl">
            <p className="text-xs tracking-[0.18em] uppercase text-silver">Constitutional Court · Plenum</p>
            <h1 className="mt-2 font-serif text-3xl sm:text-4xl leading-tight">{summaryHeading(summary, formatDate)}</h1>
            <p className="mt-3 text-foreground/65 leading-relaxed" lang="az">
              {summary.title}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-silver">
              <span className="olg-chip !py-0.5" lang="az">
                {kindLabel(summary.kind)}
              </span>
              <span>
                {bullets} position{bullets === 1 ? "" : "s"}
              </span>
              {summary.file_size_bytes && <span>· Word {formatBytes(summary.file_size_bytes)}</span>}
              <a href={summary.url} target="_blank" rel="noopener noreferrer" className="text-azure hover:underline">
                Full text on {new URL(summary.url).hostname.replace(/^www\./, "")} ↗
              </a>
            </div>
          </div>
          <SummaryDownloadButton summary={summary} className="shrink-0" />
        </div>
      </header>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_280px] gap-6 items-start olg-rise" style={{ animationDelay: "90ms" }}>
        <article className="olg-glass rounded-2xl p-6 sm:p-9">
          <p className="font-semibold italic text-[1.08rem] leading-relaxed text-foreground">
            <span className="text-silver not-italic font-normal">Topic — </span>
            {summary.topic}
          </p>
          <p className="mt-6 mb-4 text-xs tracking-[0.18em] uppercase text-silver">
            The Court&rsquo;s important positions <span className="normal-case tracking-normal">(verbatim, in Azerbaijani)</span>
          </p>
          <SummaryBody blocks={summary.body} />
          <p className="mt-8 pt-5 border-t olg-hairline text-xs text-silver leading-relaxed">
            Source: Constitutional Court of the Republic of Azerbaijan, Plenum, {kindLabel(summary.kind)} of{" "}
            {formatDate(summary.decision_date)} —{" "}
            <a href={summary.url} target="_blank" rel="noopener noreferrer" className="text-azure hover:underline">
              {summary.url.replace(/^https?:\/\//, "")}
            </a>
          </p>
        </article>

        <aside className="olg-glass-deep rounded-2xl p-5 text-sm leading-relaxed lg:sticky lg:top-24">
          <p className="olg-chip !bg-omni/60 !border-azure/45 !text-white font-medium mb-3">✦ AI-generated</p>
          <p className="text-foreground/75">
            Prepared automatically by Claude for Omni Law Firm on {formatDate(summary.published_at)} from the full text of
            the decision, following the firm&rsquo;s method for summarising Constitutional Court decisions.
          </p>
          <p className="mt-3 text-foreground/75">
            The passages are the Court&rsquo;s own words; the selection and the emphasis are the summariser&rsquo;s. It is not
            legal advice and has not been reviewed by a lawyer: check the original before citing it.
          </p>
        </aside>
      </div>
    </div>
  );
}
