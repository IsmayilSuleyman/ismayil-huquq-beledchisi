/**
 * The earlier wordings of an act (content/versions/<slug>.json), built by
 * scripts/versions/build.mts from the act's consolidated text on e-qanun,
 * its endnotes and, where those are silent, the amending acts and the text
 * as first published. Every article lists its wordings oldest first.
 */

export type Amendment = {
  id: string;
  label: string;
  /** The day of the vote, for a referendum. */
  referendum?: string;
  /** The day the wording is dated from: the instrument e-qanun's notes cite. */
  date: string;
  decision: string;
  act: { title: string; eqanunId?: number };
};

export type ArticleVersion = {
  /** The amendment that gave this wording; the original's id for the text as adopted. */
  act: string;
  from: string;
  /** The day the next wording took over; null for the wording in force. */
  to: string | null;
  title: string;
  paragraphs: string[];
  /** What the amendment did to the article, in the words of e-qanun's note or the amending act. */
  changes?: string[];
};

export type ArticleHistory = {
  number: string;
  /** Oldest first; the last one is in force. */
  versions: ArticleVersion[];
};

export type OutlineEntry =
  | { kind: "section"; label: string; title: string }
  | { kind: "chapter"; label: string; title: string }
  | { kind: "article"; number: string };

export type VersionedAct = {
  slug: string;
  title: string;
  short: string;
  eqanunId: number;
  intro: string[];
  preamble: string[];
  original: { id: string; label: string; date: string; note: string };
  amendments: Amendment[];
  outline: OutlineEntry[];
  articles: Record<string, ArticleHistory>;
  closing: { title: string; paragraphs: string[] }[];
  /** Where each kind of wording came from, for the page's note on sources. */
  sources: string[];
};
