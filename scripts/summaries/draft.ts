/**
 * The source format of a Constitutional Court summary: what the daily
 * Claude Routine writes as JSON (scripts/summaries/ROUTINE.md) after reading
 * a decision the way scripts/summaries/STYLE.md describes. The publisher
 * validates it, lays it out as the Word file (docx.ts) and stores it in
 * `court_summaries`, where the page renders the same blocks. A summary goes
 * live without review, so the checks here are the review: they hold the
 * draft to the method's shape (two to ten verbatim bullets, Azerbaijani,
 * marks balanced, no email frame, no lead-ins the method deletes).
 */

import { unbalancedMarks, plainText } from "@/lib/gazette/marks";
import { SUMMARY_TAGS, isSummaryTag, type SummaryTag } from "@/lib/gazette/summary-tags";
import { SUMMARY_KINDS, type SummaryBlock, type SummaryBullet, type SummaryKind } from "@/lib/gazette/types";

export type SummaryDraft = {
  /** The number in https://constcourt.gov.az/az/decision/<id>. */
  decision_id: number;
  /** The decision's date, YYYY-MM-DD. */
  decision_date: string;
  kind: SummaryKind;
  /** The decision's own title, as the Court's site lists it (Azerbaijani). */
  title: string;
  /** The topic line in English: the question the Court answered, without "Topic --". */
  topic: string;
  /** The decision's page, usually https://constcourt.gov.az/az/decision/<id>; e-qanun.az when the Court has not posted the text. */
  url: string;
  /** Areas of law, one to four from lib/gazette/summary-tags.ts. */
  tags: SummaryTag[];
  /**
   * Who chose and marked the passages. Left out, the summary is the
   * routine's: author "Claude", ai_generated true. Named ("Elgun Jafarov"),
   * the summary is credited to that person and ai_generated is false.
   */
  author?: string;
  /** The day a colleague's summary was circulated by email, YYYY-MM-DD; only with `author`. */
  circulated_at?: string;
  /** One block, or one per distinct question with a heading each. */
  blocks: SummaryBlock[];
};

export const ROUTINE_AUTHOR = "Claude";

export type DraftCheck =
  | { ok: true; draft: SummaryDraft; warnings: string[] }
  | { ok: false; errors: string[]; warnings: string[] };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DECISION_URL = /^https:\/\/(www\.)?constcourt\.gov\.az\/az\/decision\/(\d+)\/?$/;

/** Bullets per summary: Elgun's range (STYLE.md 5.4), a little room beyond it. */
export const MIN_BULLETS = 2;
export const MAX_BULLETS = 12;
/** Words quoted: his median was 150–220, the range 53–450 or so. */
export const MIN_WORDS = 40;
export const MAX_WORDS = 900;

/** Traces of the email frame that must not reach the page. */
const EMAIL_FRAME = /\b(Dear all|Regards|Elgun|new decision of the constitutional court|I am adding the court)/i;
/** Lead-ins and connectives the method deletes at the start of a bullet (STYLE.md 6.1). */
const LEAD_IN =
  /^(?:\*\*|__|\*)*(Konstitusiya Məhkəməsinin Plenumu (hesab edir|qeyd edir|vurğulayır)|KM Plenumu (hesab edir|qeyd edir)|Göründüyü kimi|Beləliklə|Odur ki|Bu baxımdan|Bu səbəbdən|O da nəzərə alınmalıdır ki|Nəzərə alınmalıdır ki|Qeyd olunanlara əsasən|Göstərilənlərə əsasən)\b/u;
/** A bracketed citation of an earlier decision, which the method removes even mid-sentence. */
const CITATION = /\([^()]*\btarixli\s+Qərar(dad)?[^()]*\)/u;
/** Formalities that are never quoted. */
const FORMALITY = /(dərc edildiyi gündən qüvvəyə minir|qətidir, heç bir orqan|icraatına xitam verilsin)/u;

function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * The method's small edits to copied text (STYLE.md 6.6): soft hyphens out,
 * the site's curly quotation marks straightened, whitespace collapsed.
 */
export function tidyQuote(text: string): string {
  return text
    .replace(/­/g, "")
    .replace(/[“”„«»]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Words in the quoted text of a draft (marks and brackets aside). */
export function quotedWords(blocks: SummaryBlock[]): number {
  let words = 0;
  for (const block of blocks) {
    for (const bullet of block.bullets) {
      words += plainText(bullet.text).split(/\s+/).filter(Boolean).length;
      for (const sub of bullet.sub ?? []) words += plainText(sub).split(/\s+/).filter(Boolean).length;
    }
  }
  return words;
}

export function allBullets(blocks: SummaryBlock[]): SummaryBullet[] {
  return blocks.flatMap((b) => b.bullets);
}

/**
 * Checks a parsed JSON draft and returns a clean copy or every problem
 * found. Unknown keys are errors, so a misspelt field fails loudly instead
 * of quietly vanishing. Warnings never block publishing; they are for the
 * routine's log and its second look at the draft.
 */
export function checkDraft(raw: unknown): DraftCheck {
  const errors: string[] = [];
  const warnings: string[] = [];

  function unknownKeys(obj: Record<string, unknown>, allowed: readonly string[], where: string) {
    for (const key of Object.keys(obj)) {
      if (!allowed.includes(key)) errors.push(`${where}: unknown field "${key}"`);
    }
  }

  function text(obj: Record<string, unknown>, key: string, where: string, max: number): string {
    const value = obj[key];
    if (value === undefined || value === null) {
      errors.push(`${where}.${key} is missing`);
      return "";
    }
    if (typeof value !== "string") {
      errors.push(`${where}.${key} must be a string`);
      return "";
    }
    const clean = value.replace(/\s+/g, " ").trim();
    if (!clean) errors.push(`${where}.${key} is empty`);
    if (clean.length > max) errors.push(`${where}.${key} is longer than ${max} characters`);
    return clean;
  }

  function quote(value: unknown, where: string): string {
    if (typeof value !== "string") {
      errors.push(`${where} must be a string`);
      return "";
    }
    const clean = tidyQuote(value);
    if (clean.length < 15) errors.push(`${where} is too short to be a passage of the decision`);
    if (clean.length > 3000) errors.push(`${where} is longer than 3000 characters; split it or cut it`);
    const marks = unbalancedMarks(clean);
    if (marks) errors.push(`${where}: ${marks}`);
    if (EMAIL_FRAME.test(clean)) errors.push(`${where} carries a trace of the email frame`);
    if (LEAD_IN.test(clean)) warnings.push(`${where} starts with a lead-in the method deletes (STYLE.md 6.1)`);
    if (CITATION.test(clean)) warnings.push(`${where} keeps a bracketed citation of an earlier decision (STYLE.md 5.2)`);
    if (FORMALITY.test(clean)) warnings.push(`${where} quotes a formality the method never takes (STYLE.md 5.2)`);
    return clean;
  }

  if (!isRecord(raw)) return { ok: false, errors: ["the draft must be a JSON object"], warnings };
  unknownKeys(raw, ["decision_id", "decision_date", "kind", "title", "topic", "url", "tags", "author", "circulated_at", "blocks"], "draft");

  const tags: SummaryTag[] = [];
  if (!Array.isArray(raw.tags) || raw.tags.length === 0) errors.push(`draft.tags must name one to four areas of law: ${SUMMARY_TAGS.join(", ")}`);
  else {
    for (const t of raw.tags) {
      if (!isSummaryTag(t)) errors.push(`draft.tags: "${String(t)}" is not one of ${SUMMARY_TAGS.join(", ")}`);
      else if (!tags.includes(t)) tags.push(t);
    }
    if (tags.length > 4) errors.push("draft.tags: at most four");
  }

  let author: string | undefined;
  let circulatedAt: string | undefined;
  if (raw.author !== undefined) {
    author = text(raw, "author", "draft", 120);
    if (author.toLowerCase() === ROUTINE_AUTHOR.toLowerCase()) {
      warnings.push("draft.author: the routine's own summaries carry no author field");
      author = undefined;
    }
  }
  if (raw.circulated_at !== undefined) {
    if (!author) errors.push("draft.circulated_at only goes with an author");
    circulatedAt = typeof raw.circulated_at === "string" ? raw.circulated_at : "";
    if (!isIsoDate(circulatedAt)) errors.push("draft.circulated_at must be a real date, YYYY-MM-DD");
  }

  const decisionId = raw.decision_id;
  if (!(typeof decisionId === "number" && Number.isInteger(decisionId) && decisionId > 0)) {
    errors.push("draft.decision_id must be the positive number in the decision's constcourt.gov.az link");
  }

  const decisionDate = typeof raw.decision_date === "string" ? raw.decision_date : "";
  if (!isIsoDate(decisionDate)) errors.push("draft.decision_date must be a real date, YYYY-MM-DD");
  else {
    const today = new Date().toISOString().slice(0, 10);
    if (decisionDate > today) errors.push(`draft.decision_date ${decisionDate} is in the future`);
    else if (raw.author === undefined && decisionDate < new Date(Date.now() - 400 * 86_400_000).toISOString().slice(0, 10)) {
      warnings.push(`draft.decision_date ${decisionDate} is more than a year ago`);
    }
    if (circulatedAt && isIsoDate(circulatedAt) && circulatedAt < decisionDate) {
      errors.push(`draft.circulated_at ${circulatedAt} is before the decision`);
    }
  }

  const kind = raw.kind;
  if (!(typeof kind === "string" && (SUMMARY_KINDS as readonly string[]).includes(kind))) {
    errors.push(`draft.kind must be "qərar" or "qərardad"`);
  }

  const title = text(raw, "title", "draft", 600);
  let topic = text(raw, "topic", "draft", 600);
  const stripped = topic.replace(/^\**\s*Topic\s*(--|—|–|-|:)\s*/i, "").replace(/^\**|\**$/g, "").trim();
  if (stripped !== topic) {
    warnings.push(`draft.topic: dropped the "Topic --" prefix; the layout adds it`);
    topic = stripped;
  }
  if (topic && !/[A-Za-z]{3}/.test(topic)) errors.push("draft.topic must be in English (the Azerbaijani term may follow in brackets)");
  if (EMAIL_FRAME.test(topic)) errors.push("draft.topic carries a trace of the email frame");

  const url = text(raw, "url", "draft", 500);
  if (url) {
    const m = DECISION_URL.exec(url);
    if (m) {
      if (typeof decisionId === "number" && Number(m[2]) !== decisionId) {
        errors.push(`draft.url points at decision ${m[2]} but decision_id is ${decisionId}`);
      }
    } else if (/^https:\/\/(www\.)?e-qanun\.az\//.test(url)) {
      warnings.push("draft.url is the register's page, not the Court's: fine only when the Court has not posted the text yet");
    } else errors.push("draft.url must be the decision's page on constcourt.gov.az (or e-qanun.az)");
  }

  const blocks: SummaryBlock[] = [];
  const rawBlocks: unknown[] = Array.isArray(raw.blocks) ? raw.blocks : [];
  if (rawBlocks.length === 0) errors.push("draft.blocks must be a non-empty array");
  else {
    if (rawBlocks.length > 4) errors.push("draft.blocks: at most four blocks (one per distinct question)");
    rawBlocks.forEach((rawBlock, b) => {
      const where = `blocks[${b}]`;
      if (!isRecord(rawBlock)) {
        errors.push(`${where} must be an object`);
        return;
      }
      unknownKeys(rawBlock, ["heading", "bullets"], where);
      const block: SummaryBlock = { bullets: [] };
      if (rawBlock.heading !== undefined) {
        const heading = text(rawBlock, "heading", where, 200);
        if (heading) block.heading = heading;
      } else if (rawBlocks.length > 1) errors.push(`${where}.heading is missing: every block needs one when there are several`);
      if (!Array.isArray(rawBlock.bullets) || rawBlock.bullets.length === 0) {
        errors.push(`${where}.bullets must be a non-empty array`);
        return;
      }
      rawBlock.bullets.forEach((rawBullet, i) => {
        const at = `${where}.bullets[${i}]`;
        if (!isRecord(rawBullet)) {
          errors.push(`${at} must be an object with "text"`);
          return;
        }
        unknownKeys(rawBullet, ["text", "sub"], at);
        const bullet: SummaryBullet = { text: quote(rawBullet.text, `${at}.text`) };
        if (rawBullet.sub !== undefined) {
          if (!Array.isArray(rawBullet.sub) || rawBullet.sub.length === 0) errors.push(`${at}.sub must be a non-empty array of strings`);
          else bullet.sub = rawBullet.sub.map((s, j) => quote(s, `${at}.sub[${j}]`));
        }
        block.bullets.push(bullet);
      });
      blocks.push(block);
    });
  }

  const count = allBullets(blocks).length;
  if (blocks.length > 0 && count < MIN_BULLETS) errors.push(`the summary has ${count} bullet(s); the method takes at least ${MIN_BULLETS}`);
  if (count > MAX_BULLETS) errors.push(`the summary has ${count} bullets; the method takes at most ${MAX_BULLETS} (two to eight is usual)`);
  else if (count > 10) warnings.push(`${count} bullets is more than the method usually takes (two to eight, up to ten with headings)`);
  const words = quotedWords(blocks);
  if (count >= MIN_BULLETS && words < MIN_WORDS) warnings.push(`only ${words} words quoted; check the holding and the transitional rules are there`);
  if (words > MAX_WORDS) warnings.push(`${words} words quoted; the method keeps 3–14 percent of the decision, usually 150–220 words`);

  if (errors.length > 0) return { ok: false, errors, warnings };
  return {
    ok: true,
    warnings,
    draft: {
      decision_id: decisionId as number,
      decision_date: decisionDate,
      kind: kind as SummaryKind,
      title,
      topic,
      url,
      tags,
      ...(author ? { author } : {}),
      ...(circulatedAt ? { circulated_at: circulatedAt } : {}),
      blocks,
    },
  };
}
