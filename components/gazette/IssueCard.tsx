"use client";

import Image from "next/image";
import Link from "next/link";
import DownloadButton from "@/components/gazette/DownloadButton";
import { formatDate } from "@/lib/gazette/format";
import type { Issue } from "@/lib/gazette/types";

export type IssueWithUrls = Issue & { coverUrl: string | null; pdfUrl: string };

export default function IssueCard({ issue, index = 0 }: { issue: IssueWithUrls; index?: number }) {
  return (
    <article
      className="group relative olg-glass olg-glass-hover rounded-2xl overflow-hidden flex flex-col olg-rise"
      style={{ animationDelay: `${Math.min(index, 11) * 55}ms` }}
    >
      <Link
        href={`/gazette/issues/${issue.issue_number}`}
        className="absolute inset-0 z-[5]"
        aria-label={`Read issue No. ${issue.issue_number}: ${issue.title}`}
      />

      <div className="relative aspect-[5/6] overflow-hidden bg-omni-ink">
        {issue.coverUrl ? (
          <Image
            src={issue.coverUrl}
            alt=""
            fill
            sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 22vw"
            className="object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-omni/55 via-omni-ink to-omni-ink">
            <span className="font-serif text-6xl text-white/25">
              №{issue.issue_number}
            </span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#05080f] via-[#05080f]/55 to-transparent" />
        <div className="absolute left-3 bottom-3 flex items-center gap-2">
          <span className="olg-chip !bg-omni/70 !border-azure/40 !text-white font-medium backdrop-blur-md">
            Issue No. {issue.issue_number}
          </span>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-2.5 grow">
        <p className="text-[0.7rem] tracking-[0.18em] uppercase text-silver">
          {formatDate(issue.published_at)}
        </p>
        <h3 className="font-serif text-[1.13rem] leading-snug text-foreground line-clamp-2">
          {issue.title}
        </h3>
        {issue.summary ? (
          <p className="text-sm text-foreground/60 line-clamp-2">{issue.summary}</p>
        ) : null}

        <div className="mt-auto pt-2 flex items-center justify-between gap-2 text-xs text-silver">
          <span>
            {issue.read_count.toLocaleString()} {issue.read_count === 1 ? "read" : "reads"}
            {issue.download_count > 0 ? ` · ${issue.download_count} downloads` : ""}
          </span>
          <span className="relative z-10">
            <DownloadButton
              issueId={issue.id}
              issueNumber={issue.issue_number}
              pdfUrl={issue.pdfUrl}
              variant="icon"
            />
          </span>
        </div>
      </div>
    </article>
  );
}
