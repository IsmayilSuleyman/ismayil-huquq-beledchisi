import type { BookWithUrls } from "@/lib/gazette/types";

/** Download filename: the title, made safe for every file system. */
function bookFilename(book: Pick<BookWithUrls, "title" | "author">): string {
  const base = [book.author, book.title]
    .filter(Boolean)
    .join(" - ")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return `${base || "book"}.pdf`;
}

/** Downloads a book's PDF under its title (no counter, unlike issues). */
export default function BookDownloadButton({
  book,
  variant = "primary",
  className = "",
}: {
  book: Pick<BookWithUrls, "title" | "author" | "pdfUrl">;
  variant?: "primary" | "ghost" | "icon";
  className?: string;
}) {
  const href = `${book.pdfUrl}?download=${encodeURIComponent(bookFilename(book))}`;
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
        title="Download PDF"
        aria-label={`Download “${book.title}” as PDF`}
        className={`inline-flex items-center justify-center w-9 h-9 rounded-lg bg-white/[0.06] border border-white/[0.12] text-foreground/85 hover:text-white hover:bg-white/[0.12] hover:border-azure/40 transition-colors ${className}`}
      >
        {icon}
      </a>
    );
  }

  return (
    <a href={href} className={`olg-btn ${variant === "primary" ? "olg-btn-primary" : "olg-btn-ghost"} ${className}`}>
      {icon}
      Download PDF
    </a>
  );
}
