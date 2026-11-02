/**
 * The automated gazette's source format, in the shape of the published
 * issues 3–12: four fixed sections, each a numbered list of acts, every act
 * one sentence with its number and a source link. The weekly Claude Routine
 * writes one of these as JSON (see scripts/gazette/ROUTINE.md); the
 * publisher validates it, lays it out as the issue PDF and fills the
 * `issues` row (title "Weekly Legislature Update, …", see issueTitle).
 * Everything a reader sees comes from this object, so the checks here are
 * the last line before an issue goes live without review.
 */

/** The sections of every issue, in print order. */
export const SECTION_KEYS = ["decrees", "decisions", "bills", "court"] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export const SECTION_TITLE: Record<SectionKey, string> = {
  decrees: "Azərbaycan Respublikası Prezidentinin Fərmanları",
  decisions: "Azərbaycan Respublikası Nazirlər Kabinetinin Qərarları",
  bills: "Milli Məclisdə müzakirə olunan qanun layihələri",
  court: "Konstitusiya Məhkəməsinin Qərarları",
};

export const STAGES = ["I", "II", "III"] as const;
export type Stage = (typeof STAGES)[number];

export const RULINGS = ["qərar", "qərardad"] as const;
export type Ruling = (typeof RULINGS)[number];

export const PROVISION_KINDS = ["new", "edition", "replacement"] as const;
export type ProvisionKind = (typeof PROVISION_KINDS)[number];

export type Provision = {
  /** The reference as the paragraph writes it, without its case ending: "239-cu maddə", "1.2.4-1-ci yarımbənd". */
  ref: string;
  /** The act the provision belongs to, as named in the paragraph: "İnzibati Xətalar Məcəlləsi". */
  act?: string;
  /** Added whole, given a new edition, or words replaced. */
  kind?: ProvisionKind;
  /** The wording verbatim from the act or bill; line breaks kept. */
  text: string;
  /** The previous wording, only when the act quotes it (a replacement). */
  old?: string;
};

export type GazetteEntry = {
  /** The act's number as printed on it ("804", "264"); printed as "(Fərman № 804)". */
  number?: string;
  /** Date of the act (for a bill: of its reading), YYYY-MM-DD. */
  date: string;
  /** One sentence saying what the act does, in the perfect: "… təsdiq edilib." */
  text: string;
  /** Printed as "Mənbə: <url>": the register page, or the issuing body's. */
  url: string;
  /** Bills only: the reading this week. */
  stage?: Stage;
  /** Constitutional Court only: a decision or a procedural ruling. */
  ruling?: Ruling;
  /**
   * "Nə dəyişib?": one to four sentences, in Azerbaijani, saying what the
   * act changes, written from its full text and the previous wording of
   * what it amends (ROUTINE.md step 3): the articles touched, the old rule
   * and the new one, thresholds, dates in force, who it applies to. The
   * board's panel and the issue print it under the sentence. Left out
   * when the text could not be read.
   */
  change?: string;
  /**
   * The provisions the paragraph cites, with their wording as the act or
   * bill gives it (ROUTINE.md step 3a.6). Shown only on the site: the
   * panel turns each `ref` found in `change` into a link that opens the
   * text. Never printed in the issue.
   */
  provisions?: Provision[];
  /**
   * Overrides the board's rule for this act (lib/gazette/acts.ts): true puts
   * it on the landing page's board, false keeps it off. Leave it out to let
   * the rule decide, which is the normal case.
   */
  important?: boolean;
};

export type GazetteSection = {
  /** One italic line under the heading: the Majlis in recess, the agenda of a sitting. */
  note?: string;
  /** A source for the note, printed as "Mənbə: <url>". */
  source?: string;
  entries: GazetteEntry[];
};

export type GazetteDraft = {
  period: { from: string; to: string };
  /** Issue date, YYYY-MM-DD: the Monday after the period, also for a late (catch-up) issue. */
  published_at: string;
  sections: Record<SectionKey, GazetteSection>;
  /** Set only when a person read and approved the issue before publication; the closing note says so. */
  reviewed?: boolean;
};

export type DraftCheck =
  | { ok: true; draft: GazetteDraft; warnings: string[] }
  | { ok: false; errors: string[]; warnings: string[] };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TEXT_MAX = 400;
/** Room for four full sentences of facts; the gazette_acts column has the same limit. */
export const CHANGE_MAX = 1000;
export const CHANGE_SENTENCES_MAX = 4;
export const PROVISIONS_MAX = 30;
export const PROVISION_TEXT_MAX = 6000;

/**
 * Where a provision's reference appears in the paragraph, in any case
 * ("239-cu maddədə", "239-cu maddəyə", "239-cu maddənin"): the reference
 * followed by any letters. Used by the checker and by the site's panel.
 */
export function provisionPattern(ref: string): RegExp {
  const escaped = ref.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`(?<!\\p{L}|\\d|[.-])${escaped}\\p{L}*`, "gu");
}

function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A sentence boundary inside the text: ". " (or "?", "!") followed by a capital or an opening quote. */
const SECOND_SENTENCE = /[.!?][”"»)]?\s+[A-ZƏÖÜÇŞĞİI“"«(]/u;
const SENTENCE_BOUNDARY = new RegExp(SECOND_SENTENCE.source, "gu");

/** How many sentences a passage has, by the boundaries SECOND_SENTENCE recognises. */
export function countSentences(passage: string): number {
  return passage.trim() ? (passage.match(SENTENCE_BOUNDARY)?.length ?? 0) + 1 : 0;
}

/** Words the playbook bans from a "Nə dəyişib?" paragraph: praise, forecasts, guesses. */
const CHANGE_HEDGES = /(?<!\p{L})(mühüm|ehtimal|güman|gözlənilir)(?!\p{L})/iu;

/**
 * Checks a parsed JSON draft and returns a clean copy (strings trimmed) or
 * every problem found. Unknown keys are errors, so a misspelt field fails
 * loudly instead of quietly vanishing from the issue. Warnings never block
 * publishing; they are for the routine's log.
 */
export function checkDraft(raw: unknown): DraftCheck {
  const errors: string[] = [];
  const warnings: string[] = [];

  function unknownKeys(obj: Record<string, unknown>, allowed: readonly string[], where: string) {
    for (const key of Object.keys(obj)) {
      if (!allowed.includes(key)) errors.push(`${where}: unknown field "${key}"`);
    }
  }

  function text(obj: Record<string, unknown>, key: string, where: string, max: number, required = true): string {
    const value = obj[key];
    if (value === undefined || value === null) {
      if (required) errors.push(`${where}.${key} is missing`);
      return "";
    }
    if (typeof value !== "string") {
      errors.push(`${where}.${key} must be a string`);
      return "";
    }
    const trimmed = value.trim().replace(/\s+/g, " ");
    if (required && !trimmed) errors.push(`${where}.${key} is empty`);
    if (trimmed.length > max) errors.push(`${where}.${key} is ${trimmed.length} characters; the limit is ${max}`);
    return trimmed;
  }

  function date(obj: Record<string, unknown>, key: string, where: string): string {
    const value = text(obj, key, where, 10);
    if (value && !isIsoDate(value)) errors.push(`${where}.${key} must be a real date as YYYY-MM-DD, got "${value}"`);
    return value;
  }

  if (!isRecord(raw)) {
    return { ok: false, errors: ["The draft must be a JSON object"], warnings };
  }

  unknownKeys(raw, ["period", "published_at", "sections", "reviewed"], "draft");

  let from = "";
  let to = "";
  if (isRecord(raw.period)) {
    unknownKeys(raw.period, ["from", "to"], "period");
    from = date(raw.period, "from", "period");
    to = date(raw.period, "to", "period");
    if (from && to && from > to) errors.push(`period.from (${from}) is after period.to (${to})`);
  } else {
    errors.push("period must be an object with from and to");
  }

  const publishedAt = date(raw, "published_at", "draft");
  if (publishedAt && to && publishedAt < to) {
    errors.push(`published_at (${publishedAt}) is before the end of the period (${to})`);
  }

  if (raw.reviewed !== undefined && typeof raw.reviewed !== "boolean") errors.push("draft.reviewed must be true or false");
  const reviewed = raw.reviewed === true;

  const sections = {} as Record<SectionKey, GazetteSection>;
  if (!isRecord(raw.sections)) {
    errors.push(`sections must be an object with ${SECTION_KEYS.join(", ")}`);
  } else {
    unknownKeys(raw.sections, SECTION_KEYS, "sections");
    for (const key of SECTION_KEYS) {
      const where = `sections.${key}`;
      const rawSection = raw.sections[key];
      if (!isRecord(rawSection)) {
        errors.push(`${where} is missing (an empty section is { "entries": [] })`);
        sections[key] = { entries: [] };
        continue;
      }
      unknownKeys(rawSection, ["note", "source", "entries"], where);
      const note = text(rawSection, "note", where, 600, false);
      const source = text(rawSection, "source", where, 500, false);
      if (source && !isHttpUrl(source)) errors.push(`${where}.source must be an http(s) URL`);

      const entries: GazetteEntry[] = [];
      const seen = new Set<string>();
      const rawEntries = Array.isArray(rawSection.entries) ? rawSection.entries : null;
      if (!rawEntries) errors.push(`${where}.entries must be an array`);

      for (const [i, rawEntry] of (rawEntries ?? []).entries()) {
        const at = `${where}.entries[${i}]`;
        if (!isRecord(rawEntry)) {
          errors.push(`${at} must be an object`);
          continue;
        }
        const allowed = [
          "number",
          "date",
          "text",
          "url",
          "change",
          "provisions",
          "important",
          ...(key === "bills" ? ["stage"] : []),
          ...(key === "court" ? ["ruling"] : []),
        ];
        unknownKeys(rawEntry, allowed, at);

        const number = text(rawEntry, "number", at, 40, false).replace(/^№\s*/, "");
        const entryDate = date(rawEntry, "date", at);
        const sentence = text(rawEntry, "text", at, TEXT_MAX);
        const url = text(rawEntry, "url", at, 500);
        if (url && !isHttpUrl(url)) errors.push(`${at}.url must be an http(s) URL`);

        if (sentence) {
          if (!/[.!?]$/.test(sentence)) errors.push(`${at}.text must end with a full stop`);
          if (SECOND_SENTENCE.test(sentence)) errors.push(`${at}.text must be one sentence`);
          if (/\((Fərman|Qərar)\s*№/u.test(sentence)) {
            errors.push(`${at}.text must not carry the act's number; put it in "number" and it is printed for you`);
          }
        }

        const change = text(rawEntry, "change", at, CHANGE_MAX, false);
        if (change) {
          if (!/[.!?][”"»)]?$/u.test(change)) errors.push(`${at}.change must end with a full stop`);
          const sentences = countSentences(change);
          if (sentences > CHANGE_SENTENCES_MAX) {
            errors.push(`${at}.change has ${sentences} sentences; the limit is ${CHANGE_SENTENCES_MAX}`);
          }
          if (change.includes("№")) {
            errors.push(`${at}.change must not write "№": say "168 nömrəli Fərman", so the repeat check does not mistake it for this week's act`);
          }
          if (sentence && change.toLocaleLowerCase("az") === sentence.toLocaleLowerCase("az")) {
            errors.push(`${at}.change repeats the sentence; it should say what changed, or be left out`);
          }
          if (!/\d/.test(change)) {
            warnings.push(`${at}.change has no number in it (no article, date, amount or count): is it rich in facts?`);
          }
          const hedge = CHANGE_HEDGES.exec(change);
          if (hedge) warnings.push(`${at}.change says "${hedge[1]}": no praise, guesses or forecasts in it`);
        }

        const provisions: Provision[] = [];
        if (rawEntry.provisions !== undefined) {
          if (!Array.isArray(rawEntry.provisions)) errors.push(`${at}.provisions must be an array`);
          else if (rawEntry.provisions.length > PROVISIONS_MAX) {
            errors.push(`${at}.provisions has ${rawEntry.provisions.length} items; the limit is ${PROVISIONS_MAX}`);
          } else {
            const refs = new Set<string>();
            for (const [j, rawProvision] of rawEntry.provisions.entries()) {
              const where = `${at}.provisions[${j}]`;
              if (!isRecord(rawProvision)) {
                errors.push(`${where} must be an object`);
                continue;
              }
              unknownKeys(rawProvision, ["ref", "act", "kind", "text", "old"], where);
              const ref = text(rawProvision, "ref", where, 60);
              const actName = text(rawProvision, "act", where, 200, false);
              const body = typeof rawProvision.text === "string" ? rawProvision.text.replace(/\r\n?/g, "\n").trim() : "";
              if (typeof rawProvision.text !== "string" || !body) errors.push(`${where}.text is missing`);
              else if (body.length > PROVISION_TEXT_MAX) errors.push(`${where}.text is ${body.length} characters; the limit is ${PROVISION_TEXT_MAX}`);
              const oldBody = typeof rawProvision.old === "string" ? rawProvision.old.replace(/\r\n?/g, "\n").trim() : "";
              if (rawProvision.old !== undefined && typeof rawProvision.old !== "string") errors.push(`${where}.old must be a string`);
              else if (oldBody.length > PROVISION_TEXT_MAX) errors.push(`${where}.old is ${oldBody.length} characters; the limit is ${PROVISION_TEXT_MAX}`);
              let kind: ProvisionKind | undefined;
              if (rawProvision.kind !== undefined) {
                if (typeof rawProvision.kind !== "string" || !(PROVISION_KINDS as readonly string[]).includes(rawProvision.kind)) {
                  errors.push(`${where}.kind must be one of ${PROVISION_KINDS.join(", ")}`);
                } else kind = rawProvision.kind as ProvisionKind;
              }
              if (ref) {
                if (refs.has(ref)) errors.push(`${where}: "${ref}" is listed twice`);
                refs.add(ref);
                if (!change) errors.push(`${where}: a provision needs a change paragraph to be linked from`);
                else if (!provisionPattern(ref).test(change)) {
                  warnings.push(`${where}: "${ref}" is not in the paragraph, so nothing links to it; write it there as "${ref}…"`);
                }
              }
              provisions.push({
                ref,
                ...(actName ? { act: actName } : {}),
                ...(kind ? { kind } : {}),
                text: body,
                ...(oldBody ? { old: oldBody } : {}),
              });
            }
          }
        }

        let stage: Stage | undefined;
        if (key === "bills") {
          if (typeof rawEntry.stage !== "string" || !(STAGES as readonly string[]).includes(rawEntry.stage)) {
            errors.push(`${at}.stage must be one of ${STAGES.join(", ")} (the reading this week)`);
          } else {
            stage = rawEntry.stage as Stage;
          }
        }
        let ruling: Ruling | undefined;
        if (key === "court") {
          if (rawEntry.ruling === undefined) ruling = "qərar";
          else if (typeof rawEntry.ruling !== "string" || !(RULINGS as readonly string[]).includes(rawEntry.ruling)) {
            errors.push(`${at}.ruling must be "qərar" or "qərardad"`);
          } else {
            ruling = rawEntry.ruling as Ruling;
          }
        }
        let important: boolean | undefined;
        if (rawEntry.important !== undefined) {
          if (typeof rawEntry.important !== "boolean") errors.push(`${at}.important must be true or false`);
          else important = rawEntry.important;
        }
        if ((key === "decrees" || key === "decisions") && !number) {
          warnings.push(`${at} has no number; the reader sees none`);
        }

        if (entryDate && to && entryDate > to) {
          errors.push(`${at}.date (${entryDate}) is after the end of the period (${to})`);
        } else if (entryDate && from && entryDate < from) {
          warnings.push(`${at}.date (${entryDate}) is before the period starts (${from}); fine for acts published late`);
        }

        const identity = number ? `n:${number.toLowerCase()}` : `u:${url}`;
        if (seen.has(identity)) errors.push(`${at}: the same act appears twice in ${key}`);
        seen.add(identity);

        entries.push({
          ...(number ? { number } : {}),
          date: entryDate,
          text: sentence,
          url,
          ...(stage ? { stage } : {}),
          ...(ruling ? { ruling } : {}),
          ...(change ? { change } : {}),
          ...(provisions.length ? { provisions } : {}),
          ...(important !== undefined ? { important } : {}),
        });
      }

      sections[key] = { ...(note ? { note } : {}), ...(source ? { source } : {}), entries };
    }
  }

  const total = SECTION_KEYS.reduce((n, k) => n + (sections[k]?.entries.length ?? 0), 0);
  if (isRecord(raw.sections) && total === 0) warnings.push("The issue lists no acts at all");

  if (errors.length > 0) return { ok: false, errors, warnings };
  return {
    ok: true,
    warnings,
    draft: { period: { from, to }, published_at: publishedAt, sections, ...(reviewed ? { reviewed } : {}) },
  };
}

const MONTHS_EN = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * Library title, in the pattern of issues 1–12: "Weekly Legislature Update,
 * September 5-11", "… July 29 – August 8"; years only when the period
 * crosses one.
 */
export function issueTitle(draft: Pick<GazetteDraft, "period">): string {
  const [fy, fm, fd] = draft.period.from.split("-").map(Number);
  const [ty, tm, td] = draft.period.to.split("-").map(Number);
  let range: string;
  if (fy !== ty) range = `${MONTHS_EN[fm - 1]} ${fd}, ${fy} – ${MONTHS_EN[tm - 1]} ${td}, ${ty}`;
  else if (fm !== tm) range = `${MONTHS_EN[fm - 1]} ${fd} – ${MONTHS_EN[tm - 1]} ${td}`;
  else range = `${MONTHS_EN[fm - 1]} ${fd}-${td}`;
  return `Weekly Legislature Update, ${range}`;
}

/** Every entry in print order, with its section; the issue numbers them 01, 02, … across sections. */
export function allEntries(draft: Pick<GazetteDraft, "sections">): { section: SectionKey; entry: GazetteEntry }[] {
  return SECTION_KEYS.flatMap((section) => draft.sections[section].entries.map((entry) => ({ section, entry })));
}
