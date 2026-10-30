/**
 * The automated gazette's source format. The weekly Claude Routine writes
 * one of these as JSON (see scripts/gazette/ROUTINE.md); the publisher
 * validates it, lays it out as the issue PDF and fills the `issues` row
 * from it (the row's title is built from the period, see issueTitle).
 * Everything a reader sees comes from this object, so the checks here are
 * the last line before an issue goes live without review.
 */

import { formatPeriod } from "@/lib/gazette-format";

export const ENTRY_KINDS = ["law", "bill", "decree", "order", "decision", "court", "other"] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];

/** Tag printed on each entry. */
export const KIND_LABEL: Record<EntryKind, string> = {
  law: "Qanun",
  bill: "Qanun layihəsi",
  decree: "Fərman",
  order: "Sərəncam",
  decision: "Qərar",
  court: "Məhkəmə qərarı",
  other: "Digər",
};

/** Label under each count in the at-a-glance box. */
export const KIND_PLURAL: Record<EntryKind, string> = {
  law: "Qanunlar",
  bill: "Qanun layihələri",
  decree: "Fərmanlar",
  order: "Sərəncamlar",
  decision: "Qərarlar",
  court: "Məhkəmə qərarları",
  other: "Digər sənədlər",
};

export type GazetteEntry = {
  kind: EntryKind;
  /** The act's number as printed on it: "261", "648s", "472-VIIQD". */
  number?: string;
  /** Date the act was signed or adopted, YYYY-MM-DD. */
  date: string;
  title: string;
  summary: string;
  /** Official text or register page. */
  url?: string;
};

export type GazetteSection = {
  /** "Milli Məclis", "Nazirlər Kabineti", … */
  institution: string;
  /** Right-hand line of the section header: "Qanunlar və qanun layihələri". */
  subtitle?: string;
  /** Short paragraph above the entries. */
  intro?: string;
  /** Printed instead of entries when the institution published nothing. */
  notice?: string;
  entries: GazetteEntry[];
};

export type GazetteDraft = {
  period: { from: string; to: string };
  /** Issue date, YYYY-MM-DD; usually the Saturday after the period. */
  published_at: string;
  /** The week's lead headline, printed above the overview. */
  headline: string;
  /** One or two sentences for the library card and the issue page. */
  summary: string;
  tags: string[];
  /** Editor's overview; paragraphs separated by blank lines. */
  overview: string;
  /** "Həftənin əsas məqamları": three to five one-line points. */
  highlights: string[];
  sections: GazetteSection[];
  /** Every page consulted, printed at the end of the issue. */
  sources: string[];
};

export type DraftCheck =
  | { ok: true; draft: GazetteDraft; warnings: string[] }
  | { ok: false; errors: string[]; warnings: string[] };

const LIMITS = {
  headline: 140,
  summary: 400,
  tag: 40,
  tags: 10,
  overview: 2500,
  highlight: 220,
  highlights: 6,
  entryTitle: 220,
  entrySummary: 900,
  sectionText: 1200,
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

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

/**
 * Checks a parsed JSON draft and returns a clean copy (strings trimmed,
 * tags de-duplicated) or every problem found. Unknown keys are errors, so a
 * misspelt field fails loudly instead of quietly vanishing from the issue.
 * Warnings never block publishing; they are for the routine's log.
 */
export function checkDraft(raw: unknown): DraftCheck {
  const errors: string[] = [];
  const warnings: string[] = [];

  function unknownKeys(obj: Record<string, unknown>, allowed: string[], where: string) {
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
    const trimmed = value.trim();
    if (required && !trimmed) errors.push(`${where}.${key} is empty`);
    if (trimmed.length > max) errors.push(`${where}.${key} is ${trimmed.length} characters; the limit is ${max}`);
    return trimmed;
  }

  function date(obj: Record<string, unknown>, key: string, where: string): string {
    const value = text(obj, key, where, 10);
    if (value && !isIsoDate(value)) errors.push(`${where}.${key} must be a real date as YYYY-MM-DD, got "${value}"`);
    return value;
  }

  function list(obj: Record<string, unknown>, key: string, where: string): unknown[] {
    const value = obj[key];
    if (value === undefined) {
      errors.push(`${where}.${key} is missing`);
      return [];
    }
    if (!Array.isArray(value)) {
      errors.push(`${where}.${key} must be an array`);
      return [];
    }
    return value;
  }

  if (!isRecord(raw)) {
    return { ok: false, errors: ["The draft must be a JSON object"], warnings };
  }

  unknownKeys(
    raw,
    ["period", "published_at", "headline", "summary", "tags", "overview", "highlights", "sections", "sources"],
    "draft"
  );

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

  const headline = text(raw, "headline", "draft", LIMITS.headline);
  const summary = text(raw, "summary", "draft", LIMITS.summary);
  const overview = text(raw, "overview", "draft", LIMITS.overview);

  const tags: string[] = [];
  for (const [i, tag] of list(raw, "tags", "draft").entries()) {
    if (typeof tag !== "string" || !tag.trim()) {
      errors.push(`tags[${i}] must be a non-empty string`);
      continue;
    }
    const clean = tag.trim();
    if (clean.length > LIMITS.tag) errors.push(`tags[${i}] is longer than ${LIMITS.tag} characters`);
    if (!tags.some((t) => t.toLowerCase() === clean.toLowerCase())) tags.push(clean);
  }
  if (tags.length > LIMITS.tags) errors.push(`${tags.length} tags; the limit is ${LIMITS.tags}`);

  const highlights: string[] = [];
  for (const [i, point] of list(raw, "highlights", "draft").entries()) {
    if (typeof point !== "string" || !point.trim()) {
      errors.push(`highlights[${i}] must be a non-empty string`);
      continue;
    }
    if (point.trim().length > LIMITS.highlight) {
      errors.push(`highlights[${i}] is longer than ${LIMITS.highlight} characters`);
    }
    highlights.push(point.trim());
  }
  if (highlights.length > LIMITS.highlights) {
    errors.push(`${highlights.length} highlights; the limit is ${LIMITS.highlights}`);
  }

  const sources: string[] = [];
  for (const [i, source] of list(raw, "sources", "draft").entries()) {
    if (typeof source !== "string" || !isHttpUrl(source.trim())) {
      errors.push(`sources[${i}] must be an http(s) URL`);
      continue;
    }
    if (!sources.includes(source.trim())) sources.push(source.trim());
  }
  if (Array.isArray(raw.sources) && sources.length === 0) {
    errors.push("sources is empty: list every page the issue was built from");
  }

  const sections: GazetteSection[] = [];
  const seenActs = new Set<string>();
  const rawSections = list(raw, "sections", "draft");
  if (Array.isArray(raw.sections) && rawSections.length === 0) errors.push("sections is empty");

  for (const [si, rawSection] of rawSections.entries()) {
    const where = `sections[${si}]`;
    if (!isRecord(rawSection)) {
      errors.push(`${where} must be an object`);
      continue;
    }
    unknownKeys(rawSection, ["institution", "subtitle", "intro", "notice", "entries"], where);
    const institution = text(rawSection, "institution", where, 120);
    const subtitle = text(rawSection, "subtitle", where, 160, false);
    const intro = text(rawSection, "intro", where, LIMITS.sectionText, false);
    const notice = text(rawSection, "notice", where, LIMITS.sectionText, false);

    const entries: GazetteEntry[] = [];
    for (const [ei, rawEntry] of list(rawSection, "entries", where).entries()) {
      const at = `${where}.entries[${ei}]`;
      if (!isRecord(rawEntry)) {
        errors.push(`${at} must be an object`);
        continue;
      }
      unknownKeys(rawEntry, ["kind", "number", "date", "title", "summary", "url"], at);

      const kind = rawEntry.kind;
      if (typeof kind !== "string" || !(ENTRY_KINDS as readonly string[]).includes(kind)) {
        errors.push(`${at}.kind must be one of ${ENTRY_KINDS.join(", ")}`);
      }
      const number = text(rawEntry, "number", at, 40, false);
      const entryDate = date(rawEntry, "date", at);
      const entryTitle = text(rawEntry, "title", at, LIMITS.entryTitle);
      const entrySummary = text(rawEntry, "summary", at, LIMITS.entrySummary);
      const url = text(rawEntry, "url", at, 500, false);
      if (url && !isHttpUrl(url)) errors.push(`${at}.url must be an http(s) URL`);

      if (entryDate && to && entryDate > to) {
        errors.push(`${at}.date (${entryDate}) is after the end of the period (${to})`);
      } else if (entryDate && from && entryDate < from) {
        warnings.push(`${at}.date (${entryDate}) is before the period starts (${from}); fine for acts published late`);
      }

      if (number) {
        const key = `${kind}|${number.toLowerCase()}`;
        if (seenActs.has(key)) errors.push(`${at}: ${kind} No. ${number} appears twice in the issue`);
        seenActs.add(key);
      }

      entries.push({
        kind: kind as EntryKind,
        ...(number ? { number } : {}),
        date: entryDate,
        title: entryTitle,
        summary: entrySummary,
        ...(url ? { url } : {}),
      });
    }

    if (entries.length === 0 && !notice) {
      errors.push(`${where} (${institution || "unnamed"}) has no entries and no notice explaining why`);
    }

    sections.push({
      institution,
      ...(subtitle ? { subtitle } : {}),
      ...(intro ? { intro } : {}),
      ...(notice ? { notice } : {}),
      entries,
    });
  }

  const total = sections.reduce((n, s) => n + s.entries.length, 0);
  if (rawSections.length > 0 && total === 0) warnings.push("The issue lists no acts at all");
  if (highlights.length === 0 && total > 0) warnings.push("No highlights: the at-a-glance box will show counts only");

  if (errors.length > 0) return { ok: false, errors, warnings };
  return {
    ok: true,
    warnings,
    draft: {
      period: { from, to },
      published_at: publishedAt,
      headline,
      summary,
      tags,
      overview,
      highlights,
      sections,
      sources,
    },
  };
}

/** Library title, in the pattern every issue has used: "…, 5–11 sentyabr 2026". */
export function issueTitle(draft: Pick<GazetteDraft, "period">): string {
  return `Həftəlik qanunvericilik icmalı, ${formatPeriod(draft.period.from, draft.period.to)}`;
}

/** Acts per kind across the issue, in ENTRY_KINDS order, zero counts left out. */
export function countByKind(draft: GazetteDraft): { kind: EntryKind; count: number }[] {
  const counts = new Map<EntryKind, number>();
  for (const section of draft.sections) {
    for (const entry of section.entries) counts.set(entry.kind, (counts.get(entry.kind) ?? 0) + 1);
  }
  return ENTRY_KINDS.filter((k) => counts.has(k)).map((kind) => ({ kind, count: counts.get(kind)! }));
}
