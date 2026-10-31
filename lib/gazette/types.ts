export type Issue = {
  id: string;
  issue_number: number;
  title: string;
  summary: string | null;
  published_at: string; // ISO date
  tags: string[];
  pdf_path: string;
  cover_path: string | null;
  page_count: number | null;
  file_size_bytes: number | null;
  read_count: number;
  download_count: number;
  created_at: string;
  updated_at: string;
};

export type IssueComment = {
  id: string;
  issue_id: string;
  author_name: string;
  body: string;
  created_at: string;
};

export type Book = {
  id: string;
  title: string;
  author: string | null;
  description: string | null;
  year: number | null;
  tags: string[];
  pdf_path: string;
  cover_path: string | null;
  page_count: number | null;
  file_size_bytes: number | null;
  created_at: string;
  updated_at: string;
};

export type BookWithUrls = Book & { coverUrl: string | null; pdfUrl: string };

/** One quoted passage of a Constitutional Court summary; `sub` holds the decision's own sub-list, if any. */
export type SummaryBullet = {
  /** Verbatim text of the Court, with **bold**, __underline__ and *italic* marks (lib/gazette/marks.ts). */
  text: string;
  sub?: string[];
};

/** A group of bullets; a decision with two or three distinct questions gets one block per question, each with its heading. */
export type SummaryBlock = {
  /** The summariser's own few words naming the issue, in Azerbaijani: "(A) İlkin müqavilə üzrə ödəniş". */
  heading?: string;
  bullets: SummaryBullet[];
};

export const SUMMARY_KINDS = ["qərar", "qərardad"] as const;
export type SummaryKind = (typeof SUMMARY_KINDS)[number];

export type CourtSummary = {
  id: string;
  /** The number in https://constcourt.gov.az/az/decision/<id>. */
  decision_id: number;
  decision_date: string; // ISO date
  kind: SummaryKind;
  /** The decision's own title, as the Court's site lists it (Azerbaijani). */
  title: string;
  /** The English topic line: the question the Court answered. */
  topic: string;
  url: string;
  body: SummaryBlock[];
  /** Who chose and marked the passages: "Claude" for the routine, "Elgun Jafarov" for his emails. */
  author: string;
  ai_generated: boolean;
  /** The day a colleague's summary was circulated by email; null for the routine's. */
  circulated_at: string | null;
  /** Areas of law (lib/gazette/summary-tags.ts). */
  tags: string[];
  docx_path: string;
  file_size_bytes: number | null;
  published_at: string;
  created_at: string;
  updated_at: string;
};

export type CourtSummaryWithUrls = CourtSummary & { docxUrl: string };
