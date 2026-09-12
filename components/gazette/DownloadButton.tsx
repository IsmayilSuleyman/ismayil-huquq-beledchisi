"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { issueFilename } from "@/lib/gazette-format";

type Props = {
  issueId: string;
  issueNumber: number;
  pdfUrl: string;
  variant?: "primary" | "ghost" | "icon";
  className?: string;
};

export function DownloadButton({
  issueId,
  issueNumber,
  pdfUrl,
  variant = "primary",
  className = "",
}: Props) {
  const href = `${pdfUrl}?download=${encodeURIComponent(issueFilename(issueNumber))}`;

  function track() {
    // Fire-and-forget download counter; never block the download itself.
    createSupabaseBrowserClient()
      ?.rpc("increment_download", { issue: issueId })
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
        title="PDF-i yüklə"
        aria-label={`${issueNumber} nömrəli buraxılışın PDF-ini yüklə`}
        className={`tool-btn ${className}`}
      >
        {icon}
      </a>
    );
  }

  return (
    <a
      href={href}
      onClick={track}
      className={`btn ${variant === "primary" ? "btn-primary" : "btn-ghost"} ${className}`}
    >
      {icon}
      PDF-i yüklə
    </a>
  );
}
