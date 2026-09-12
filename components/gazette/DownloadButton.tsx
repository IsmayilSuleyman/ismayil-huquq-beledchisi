"use client";

import { getBrowserSupabase } from "@/lib/gazette/supabase";

type Props = {
  issueId: string;
  issueNumber: number;
  pdfUrl: string;
  variant?: "primary" | "ghost" | "icon";
  className?: string;
};

export default function DownloadButton({
  issueId,
  issueNumber,
  pdfUrl,
  variant = "primary",
  className = "",
}: Props) {
  const filename = `omni-law-gazette-issue-${String(issueNumber).padStart(3, "0")}.pdf`;
  const href = `${pdfUrl}?download=${encodeURIComponent(filename)}`;

  function track() {
    // Fire-and-forget download counter; never block the download itself.
    getBrowserSupabase()
      .rpc("increment_download", { issue: issueId })
      .then(undefined, () => {});
  }

  const icon = (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3v12m0 0 4.5-4.5M12 15l-4.5-4.5M4 19h16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  if (variant === "icon") {
    return (
      <a
        href={href}
        onClick={track}
        title="Download PDF"
        aria-label={`Download issue ${issueNumber} PDF`}
        className={`inline-flex items-center justify-center w-9 h-9 rounded-lg bg-white/[0.06] border border-white/[0.12] text-foreground/85 hover:text-white hover:bg-white/[0.12] hover:border-azure/40 transition-colors ${className}`}
      >
        {icon}
      </a>
    );
  }

  return (
    <a
      href={href}
      onClick={track}
      className={`olg-btn ${variant === "primary" ? "olg-btn-primary" : "olg-btn-ghost"} ${className}`}
    >
      {icon}
      Download PDF
    </a>
  );
}
