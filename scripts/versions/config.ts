/** What the versions build needs to know about one act (scripts/versions/acts/<slug>.ts). */

export type AmendmentConfig = {
  /** Short id used in the data ("2016"). */
  id: string;
  /** How the page names it ("2016-cı il 26 sentyabr referendumu"). */
  label: string;
  /** The day of the vote, for a referendum. */
  referendum?: string;
  /** The day the change is dated from: the instrument e-qanun's notes cite. */
  date: string;
  /** That instrument in words. */
  decision: string;
  /** Its number as e-qanun's endnotes cite it ("20/83"): how a note is matched to the amendment. */
  decisionNumber: string;
  /** The amending act itself. */
  act: { title: string; eqanunId?: number };
  /** Where the changes are read from: e-qanun's endnotes, or the amending act's text. */
  from: "endnotes" | "act";
};

export type ActConfig = {
  slug: string;
  title: string;
  short: string;
  eqanunId: number;
  original: { id: string; label: string; date: string; note: string };
  /** Oldest first. */
  amendments: AmendmentConfig[];
  sources: {
    /** The act's page on e-qanun, as saved (cleaned on the first build). */
    eqanun: string;
    /** Amending acts read from their own text, by amendment id. */
    acts: Record<string, string>;
    /** The text as published before an amendment (transcribed), by amendment id. */
    witnesses: Record<string, { file: string; label: string }>;
  };
  /**
   * Corrections the build makes by hand, each with its reason; applied to
   * the article as it stood before `before` (after undoing that amendment).
   */
  fixes: { article: string; before: string; find: string; replace: string; reason: string }[];
  /**
   * Words an amendment quotes one way and the consolidated text prints
   * another (the act's "Respublikası", e-qanun's "Respublikasının"): the
   * build looks for `text` where the operation quotes `quote`.
   */
  quotes: { amendment: string; article: string; quote: string; text: string; reason: string }[];
};
