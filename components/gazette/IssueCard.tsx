"use client";

import Image from "next/image";
import Link from "next/link";
import { DownloadButton } from "@/components/gazette/DownloadButton";
import { formatDate } from "@/lib/gazette-format";
import type { IssueWithUrls } from "@/lib/gazette";

export function IssueCard({ issue, index = 0 }: { issue: IssueWithUrls; index?: number }) {
  return (
    <article
      className="glass rise group relative flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-glass-wood"
      style={{ animationDelay: `${Math.min(index, 11) * 55}ms` }}
    >
      <Link
        href={`/gazette/${issue.issue_number}`}
        className="absolute inset-0 z-[5]"
        aria-label={`${issue.issue_number} nömrəli buraxılışı oxu: ${issue.title}`}
      />

      <div className="relative aspect-[5/6] overflow-hidden bg-brand-cream-deep dark:bg-black/40">
        {issue.coverUrl ? (
          <Image
            src={issue.coverUrl}
            alt=""
            fill
            sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 22vw"
            className="object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-brand-wood/40 via-brand-wood-deep to-brand-wood-deep">
            <span className="text-6xl text-white/25">№{issue.issue_number}</span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#1c1410] via-[#1c1410]/50 to-transparent" />
        <div className="absolute bottom-3 left-3 flex items-center gap-2">
          <span className="chip chip-solid">№ {issue.issue_number}</span>
        </div>
      </div>

      <div className="flex grow flex-col gap-2.5 p-4">
        <p className="text-[10px] uppercase tracking-[0.18em] text-ink/45 dark:text-white/45">
          {formatDate(issue.published_at)}
        </p>
        <h3 className="line-clamp-2 text-[1.13rem] font-semibold leading-snug text-ink dark:text-brand-cream">
          {issue.title}
        </h3>
        {issue.summary ? (
          <p className="line-clamp-2 text-sm text-ink/55 dark:text-white/55">{issue.summary}</p>
        ) : null}

        <div className="mt-auto flex items-center justify-between gap-2 pt-2 text-xs text-ink/45 dark:text-white/45">
          <span className="num">
            {issue.read_count.toLocaleString("az-AZ")} oxunma
            {issue.download_count > 0 ? ` · ${issue.download_count} yükləmə` : ""}
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
