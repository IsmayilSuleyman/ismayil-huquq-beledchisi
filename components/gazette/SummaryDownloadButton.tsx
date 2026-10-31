import { summaryFilename } from "@/lib/gazette/summaries";
import type { CourtSummaryWithUrls } from "@/lib/gazette/types";

/** Downloads a summary's Word file under its name ("KM Qərardad 25.09.2026 - …docx"). */
export default function SummaryDownloadButton({
  summary,
  variant = "primary",
  className = "",
}: {
  summary: Pick<CourtSummaryWithUrls, "kind" | "decision_date" | "topic" | "docxUrl">;
  variant?: "primary" | "ghost" | "icon";
  className?: string;
}) {
  const href = `${summary.docxUrl}?download=${encodeURIComponent(summaryFilename(summary))}`;
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
        title="Download as Word"
        aria-label="Download this summary as a Word file"
        className={`inline-flex items-center justify-center w-9 h-9 rounded-lg bg-veil/[0.06] border border-veil/[0.12] text-foreground/85 hover:text-foreground hover:bg-veil/[0.12] hover:border-azure/40 transition-colors ${className}`}
      >
        {icon}
      </a>
    );
  }

  return (
    <a href={href} className={`olg-btn ${variant === "primary" ? "olg-btn-primary" : "olg-btn-ghost"} ${className}`}>
      {icon}
      Download Word
    </a>
  );
}
