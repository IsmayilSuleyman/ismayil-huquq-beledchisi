/**
 * The gazette's acts as records of their own: one row per act of every
 * issue, in the `gazette_acts` table (migration
 * supabase/migrations/20261031120000_gazette_acts.sql). The publisher
 * writes them alongside the issue; the landing page's board reads the
 * last month's and shows the important ones as stickers.
 *
 * What counts as important is decided here, by rule, from the act's
 * section and sentence: every Constitutional Court ruling, and every act
 * that touches corporate, banking, tax, civil, criminal or administrative
 * law. Diplomatic acts and everything else stay off the board. A draft can
 * override the rule for one act with `"important": true|false`
 * (scripts/gazette/draft.ts).
 */

export const ACT_SECTIONS = ["decrees", "decisions", "bills", "court"] as const;
export type ActSection = (typeof ACT_SECTIONS)[number];

export const SECTION_LABEL: Record<ActSection, string> = {
  decrees: "Presidential decree",
  decisions: "Cabinet decision",
  bills: "Bill",
  court: "Constitutional Court",
};

export const SECTION_SHORT: Record<ActSection, string> = {
  decrees: "Decrees",
  decisions: "Cabinet",
  bills: "Bills",
  court: "Court",
};

export const ACT_TOPICS = [
  "court",
  "criminal",
  "civil",
  "tax",
  "banking",
  "corporate",
  "administrative",
  "labour",
  "diplomatic",
] as const;
export type ActTopic = (typeof ACT_TOPICS)[number];

export const TOPIC_LABEL: Record<ActTopic, string> = {
  court: "Constitutional Court",
  criminal: "Criminal",
  civil: "Civil",
  tax: "Tax & customs",
  banking: "Banking & finance",
  corporate: "Corporate & commercial",
  administrative: "Administrative",
  labour: "Labour",
  diplomatic: "Diplomatic",
};

/** The topics that put an act on the board. Labour and diplomatic acts are recognised but stay off it. */
export const IMPORTANT_TOPICS: ReadonlySet<ActTopic> = new Set<ActTopic>([
  "court",
  "criminal",
  "civil",
  "tax",
  "banking",
  "corporate",
  "administrative",
]);

/**
 * Keyword rules, matched against the sentence in lower case (Azerbaijani
 * casing, so İ → i and I → ı). The order is the order of the topic list
 * on a sticker. Names of bodies and companies are not law: "Dövlət Vergi
 * Xidməti" is removed before matching, and "səhmdar cəmiyyəti" or "MMC" in
 * a name do not make an act corporate.
 */
// JavaScript's \b knows only ASCII letters, so it would see a word boundary
// inside "cədvəl"; these look for a real letter on either side instead.
const B0 = "(?<!\\p{L})";
const B1 = "(?!\\p{L})";
const rule = (source: string) => new RegExp(source, "u");

const TOPIC_RULES: [ActTopic, RegExp][] = [
  ["criminal", rule("cinayət məcəllə|cinayət[- ]prosessual|cəzaların icrası məcəllə")],
  ["civil", rule("mülki məcəllə|mülki prosessual|ailə məcəllə|mənzil məcəllə")],
  ["tax", rule(`${B0}vergi|${B0}ədv${B1}|aksiz|gömrük (?:məcəllə|rüsum|tarif)`)],
  ["banking", rule(`${B0}bank|kredit|qiymətli kağız|sekyuritizasiya|ödəniş sistem|valyuta|maliyyə bazar`)],
  [
    "corporate",
    rule(
      "kommersiya (?:hüquqi şəxs|təşkilat|qurum)|hüquqi şəxslərin dövlət qeydiyyatı|korporativ|sahibkarlıq (?:fəaliyyəti )?(?:haqqında|sahəsində)|investisiya fəaliyyəti|rəqabət haqqında|dövlət satınalma|müflisləşmə|iflas",
    ),
  ],
  ["administrative", rule("inzibati xəta|inzibati prosessual|inzibati icraat")],
  ["labour", rule("əmək məcəllə|əmək pensiya|əməkhaqq")],
  [
    "diplomatic",
    rule(`diplomatik|səfir|konsul|hökumətlərarası|${B0}saziş|beynəlxalq (?:müqavilə|təşkilat|ittifaq)|ratifikasiya|xarici (?:işlər|siyasət)`),
  ],
];

export type Classification = { topics: ActTopic[]; important: boolean };

/** Topics an act touches, and whether they put it on the board. `override` is the draft's say, when it has one. */
export function classifyAct(
  act: { section: ActSection; text: string },
  override?: boolean,
): Classification {
  const haystack = act.text.toLocaleLowerCase("az").replace(/dövlət vergi xidməti/gu, " ");
  const topics: ActTopic[] = [];
  if (act.section === "court") topics.push("court");
  for (const [topic, rule] of TOPIC_RULES) {
    if (rule.test(haystack)) topics.push(topic);
  }
  const byRule = topics.some((t) => IMPORTANT_TOPICS.has(t));
  return { topics, important: override ?? byRule };
}

/** A row of `gazette_acts` as the site reads it. */
export type GazetteAct = {
  id: string;
  issue_number: number;
  /** Print order in the issue, 1-based across the four sections. */
  position: number;
  section: ActSection;
  number: string | null;
  /** YYYY-MM-DD */
  date: string;
  text: string;
  url: string;
  stage: "I" | "II" | "III" | null;
  ruling: "qərar" | "qərardad" | null;
  topics: ActTopic[];
  important: boolean;
  /** Readers' votes on how important the act is, 1–5 stars each (migration 20261031150000). */
  rating_count: number;
  rating_sum: number;
};

/** Readers can vote an act off the board: this many votes averaging under this many stars. */
export const RATING_MIN_VOTES = 2;
export const RATING_MIN_AVERAGE = 3;

export type Rating = Pick<GazetteAct, "rating_count" | "rating_sum">;

/** The average star rating, or null before the first vote. */
export function averageStars(act: Rating): number | null {
  return act.rating_count > 0 ? act.rating_sum / act.rating_count : null;
}

/** Whether readers have voted the act off the board. */
export function ratedOff(act: Rating): boolean {
  const average = averageStars(act);
  return act.rating_count >= RATING_MIN_VOTES && average !== null && average < RATING_MIN_AVERAGE;
}

/** Whether the act may show on the board: important by rule or by the draft, and not voted off. */
export function onBoard(act: Pick<GazetteAct, "important"> & Rating): boolean {
  return act.important && !ratedOff(act);
}

/** The board shows at most this many acts. */
export const BOARD_LIMIT = 12;

/** An act's standing for the picks: its average, with an unrated act counted as neutral. */
export function boardScore(act: Rating): number {
  return averageStars(act) ?? RATING_MIN_AVERAGE;
}

type Pickable = Pick<GazetteAct, "important" | "date" | "section" | "issue_number" | "position"> & Rating;

const SECTION_RANK: Record<ActSection, number> = { court: 0, decrees: 1, decisions: 2, bills: 3 };

/**
 * The board's picks: the eligible acts best rated by readers, the newest
 * first among equals (and the court first on a day), cut at the limit.
 */
export function pickBoard<T extends Pickable>(acts: T[], limit = BOARD_LIMIT): T[] {
  return acts
    .filter(onBoard)
    .sort(
      (a, b) =>
        boardScore(b) - boardScore(a) ||
        b.rating_count - a.rating_count ||
        b.date.localeCompare(a.date) ||
        SECTION_RANK[a.section] - SECTION_RANK[b.section] ||
        b.issue_number - a.issue_number ||
        a.position - b.position,
    )
    .slice(0, limit);
}

const READING: Record<NonNullable<GazetteAct["stage"]>, string> = { I: "1st reading", II: "2nd reading", III: "3rd reading" };

/** The sticker's label: "Decree № 807", "Cabinet № 346", "Bill · 1st reading", "Court · ruling". */
export function actLabel(act: Pick<GazetteAct, "section" | "number" | "stage" | "ruling">): string {
  switch (act.section) {
    case "decrees":
      return act.number ? `Decree № ${act.number}` : "Decree";
    case "decisions":
      return act.number ? `Cabinet № ${act.number}` : "Cabinet decision";
    case "bills":
      return act.stage ? `Bill · ${READING[act.stage]}` : "Bill";
    case "court":
      return act.ruling === "qərardad" ? "Court · procedural ruling" : "Court · decision";
  }
}

/** The host a source link points at, for the panel: "e-qanun.az", "meclis.gov.az". */
export function sourceHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Today minus `days`, as YYYY-MM-DD, for the board's window. */
export function windowStart(today: Date, days: number): string {
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - days));
  return d.toISOString().slice(0, 10);
}

/** Newest first; within a day, court first, then decrees, decisions, bills; then print order. */
export function sortForBoard<T extends Pick<GazetteAct, "date" | "section" | "issue_number" | "position">>(acts: T[]): T[] {
  return [...acts].sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      SECTION_RANK[a.section] - SECTION_RANK[b.section] ||
      b.issue_number - a.issue_number ||
      a.position - b.position,
  );
}
