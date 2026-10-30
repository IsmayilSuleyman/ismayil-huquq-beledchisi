/**
 * The collector's pure logic: parsing dates and titles from the sources,
 * mapping register types to kinds, and deciding when two listings are the
 * same act. Kept apart from collect.mts so it can be tested without the
 * network.
 */

import type { EntryKind } from "@/scripts/gazette/draft";

export type Lead = {
  kind: EntryKind;
  institution: string;
  number?: string;
  /**
   * The date that places the act in a week: the act's own date, except for
   * laws, which count from the day president.az published them as signed.
   */
  date: string;
  /** The date printed on the act, when it differs from `date` (a law's adoption date). */
  actDate?: string;
  title: string;
  /** Where readers find the act. */
  url: string;
  /** Where its full text can be read. */
  textUrl?: string;
  source: string;
  /** Issue that already printed this act (found by number or register id). */
  printedIn?: number;
  /** A register-only act dated before the period but registered since: report it now unless printed. */
  late?: boolean;
  /** A bill's reading in the period: "I oxunuş", "II oxunuş", "III oxunuş". */
  stage?: string;
};

export type BillReading = { stage: string; date: string | null };

/**
 * A meclis.gov.az bill page has one tab per reading ("I OXUNUŞ", …) and one
 * pane per tab, each starting with its date. Returns the readings in order;
 * the page's list entry only shows the latest one.
 */
export function parseBillReadings(html: string): BillReading[] {
  const labels = [...(/<div class="tabs-list">([\s\S]*?)<\/ul>/.exec(html)?.[1] ?? "").matchAll(/<li class="tab[^"]*">([\s\S]*?)<\/li>/g)]
    .map((m) => cleanHtml(m[1]))
    .filter((l) => /OXUNUŞ/i.test(l));
  const panes = html.split(/<div class="tab-item"/).slice(1);
  return labels.map((label, i) => ({
    stage: label.replace(/\s*OXUNUŞ\s*/i, " oxunuş").trim(),
    date: azDate(cleanHtml(/<p[^>]*>([\s\S]*?)<\/p>/.exec(panes[i] ?? "")?.[1] ?? "")),
  }));
}

export const PRESIDENT = "Azərbaycan Respublikasının Prezidenti";
export const CABINET = "Nazirlər Kabineti";
export const MAJLIS = "Milli Məclis";
export const CONST_COURT = "Konstitusiya Məhkəməsi";

const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avqust", "sentyabr", "oktyabr", "noyabr", "dekabr"];

/** "28 oktyabr 2026", "30 Oktyabr 2026 - 13:12" → "2026-10-28". */
export function azDate(text: string): string | null {
  const m = /(\d{1,2})\s+([A-Za-zƏəİıÖöÜüĞğŞşÇç]+)\s+(\d{4})/.exec(text);
  if (!m) return null;
  const month = MONTHS.indexOf(m[2].toLocaleLowerCase("az"));
  if (month < 0) return null;
  return `${m[3]}-${String(month + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

/** "26.10.2026" or "20.10.26" → "2026-10-26". */
export function dottedDate(text: string): string | null {
  const m = /(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})\b/.exec(text);
  if (!m) return null;
  const year = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${year}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

/** Shifts an ISO date by whole days. */
export function addDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** Named entities the sources use; Azerbaijani pages spell ü, ö, ç this way. */
const ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  laquo: "«",
  raquo: "»",
  ldquo: "“",
  rdquo: "”",
  lsquo: "‘",
  rsquo: "’",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  uuml: "ü",
  Uuml: "Ü",
  ouml: "ö",
  Ouml: "Ö",
  ccedil: "ç",
  Ccedil: "Ç",
  euml: "ë",
  iacute: "í",
  shy: "",
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
    if (name[0] === "#") {
      const code = name[1] === "x" || name[1] === "X" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[name] ?? whole;
  });
}

/** Text of an HTML fragment, entities decoded, whitespace collapsed. */
export function cleanHtml(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/** president.az ends titles with the act's name: "… haqqında Azərbaycan Respublikası Prezidentinin Sərəncamı". */
export function stripActName(title: string): string {
  return title
    .replace(/\s*Azərbaycan Respublikası(nın)? Prezidentinin (Fərmanı|Sərəncamı)\s*$/u, "")
    .replace(/\s*Azərbaycan Respublikasının (Konstitusiya )?Qanunu\s*$/u, "")
    .trim();
}

/** Comparable form of a whole title: letters and digits only, lower case. */
export function titleKey(title: string): string {
  return stripActName(title)
    .toLocaleLowerCase("az")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

/**
 * Same title: identical once normalised, or one is the other cut short
 * (lists truncate long titles) and still covers nearly all of it. Titles of
 * different acts often share a long opening ("Azərbaycan Respublikası
 * Hökuməti ilə … arasında"), so a shared prefix alone is not enough.
 */
export function sameTitle(a: string, b: string): boolean {
  const [x, y] = [titleKey(a), titleKey(b)];
  if (x === y) return x.length > 0;
  const [short, long] = x.length < y.length ? [x, y] : [y, x];
  return short.length >= 40 && long.startsWith(short) && short.length >= 0.9 * long.length;
}

/**
 * Close wording: most words shared (Jaccard index of the word sets). Catches
 * the same title written two ways, such as "Cinayət-Prosessual
 * Məcəlləsinin" on one site and "CPM-in" on another.
 */
export function similarTitle(a: string, b: string): boolean {
  const words = (t: string) =>
    new Set(
      stripActName(t)
        .toLocaleLowerCase("az")
        .split(/[^\p{L}\p{N}]+/u)
        .filter((w) => w.length > 1)
    );
  const [x, y] = [words(a), words(b)];
  if (x.size === 0 || y.size === 0) return false;
  let shared = 0;
  for (const w of x) if (y.has(w)) shared++;
  return shared / (x.size + y.size - shared) >= 0.75;
}

/**
 * An act's own title on president.az ends with the act's name ("…
 * Prezidentinin Sərəncamı", "… Qanunu"). Anything else in those lists is
 * material attached to an act and posted on its own: an approved charter
 * ("… ƏSASNAMƏ … Fərmanı ilə təsdiq edilmişdir") or programme ("… Dövlət
 * Proqramı").
 */
export function isActTitle(title: string): boolean {
  return /(Prezidentinin (Fərmanı|Sərəncamı)|Respublikasının (Konstitusiya )?Qanunu)\s*$/u.test(title.trim());
}

/** The numbers a title cites (articles, parts): "61 və 71-ci maddələri … 288.2-ci" → 61, 71, 288.2. */
function citedNumbers(title: string): Set<string> {
  return new Set(title.match(/\d+(?:\.\d+)*/g) ?? []);
}

/**
 * Court rulings are listed with heavy abbreviations on the court's site
 * ("AR CM-in 288.2-ci mad."); the articles they cite still identify them.
 */
function sameCitations(a: string, b: string): boolean {
  const [x, y] = [citedNumbers(a), citedNumbers(b)];
  const [small, large] = x.size <= y.size ? [x, y] : [y, x];
  if (small.size < 2) return false;
  for (const n of small) if (!large.has(n)) return false;
  return true;
}

/** "№ 728s" → "728": lists sometimes drop the s of a Cabinet order's number. */
function normNumber(n: string): string {
  return n.replace(/^№\s*/, "").replace(/\s+/g, "").toLowerCase().replace(/s$/, "");
}

type Comparable = Pick<Lead, "kind" | "number" | "title" | "date">;

/**
 * Same act: same kind, and the same number when both have one. Otherwise
 * the same title, or on the same date a similar one (for court rulings,
 * the same cited articles).
 */
export function sameAct(a: Comparable, b: Comparable): boolean {
  if (a.kind !== b.kind) return false;
  if (a.number && b.number) return normNumber(a.number) === normNumber(b.number);
  if (sameTitle(a.title, b.title)) return true;
  if (a.date !== b.date) return false;
  return similarTitle(a.title, b.title) || (a.kind === "court" && sameCitations(a.title, b.title));
}

/** Same act regardless of date: number, or the same title. For listings dated differently. */
export function sameActAnyDate(a: Comparable, b: Comparable): boolean {
  if (a.kind !== b.kind) return false;
  if (a.number && b.number) return normNumber(a.number) === normNumber(b.number);
  return sameTitle(a.title, b.title);
}

/**
 * Folds each extra listing into the copy of the same act from another
 * source, filling in what that copy lacks (number, act date, text page).
 * Listings from the same source are never merged with each other: a
 * source lists each act once, so two of its items are two acts.
 */
export function mergeLeads(base: Lead[], extra: Lead[]): Lead[] {
  const out = base.map((l) => ({ ...l }));
  for (const item of extra) {
    const twin = out.find((r) => r.source !== item.source && sameAct(r, item));
    if (twin) {
      twin.number ??= item.number;
      twin.actDate ??= item.actDate;
      twin.textUrl ??= item.textUrl;
    } else {
      out.push({ ...item });
    }
  }
  return out;
}

/**
 * Laws are placed in the week president.az published them as signed,
 * whatever their adoption date: the register and the Majlis list date a
 * law by its adoption, which would put it in an earlier issue than the one
 * where it becomes law, or in two issues. Those listings only lend the
 * signed law its number, adoption date and text page.
 */
export function enrichLaws(signed: Lead[], adopted: Lead[]): Lead[] {
  return signed.map((law) => {
    const match = adopted.find((a) => a.kind === "law" && sameTitle(a.title, law.title));
    if (!match) return law;
    return {
      ...law,
      number: law.number ?? match.number,
      actDate: law.actDate ?? match.actDate ?? match.date,
      textUrl: law.textUrl ?? match.textUrl,
    };
  });
}

/** e-qanun's register type → kind and institution. */
export function registerKind(typeName: string): { kind: EntryKind; institution: string } {
  const t = typeName.toLocaleUpperCase("az");
  if (t.includes("KONSTİTUSİYA MƏHKƏMƏSİ")) return { kind: "court", institution: CONST_COURT };
  if (t === "QANUNLAR" || t.includes("KONSTİTUSİYA QANUN")) return { kind: "law", institution: MAJLIS };
  if (t.includes("MİLLİ MƏCLİS")) return { kind: "decision", institution: MAJLIS };
  if (t.includes("PREZİDENTİNİN FƏRMAN")) return { kind: "decree", institution: PRESIDENT };
  if (t.includes("PREZİDENTİNİN SƏRƏNCAM")) return { kind: "order", institution: PRESIDENT };
  if (t.includes("NAZİRLƏR KABİNETİNİN QƏRAR")) return { kind: "decision", institution: CABINET };
  if (t.includes("NAZİRLƏR KABİNETİNİN SƏRƏNCAM")) return { kind: "order", institution: CABINET };
  if (t.includes("MƏRKƏZİ BANK")) return { kind: "decision", institution: "Mərkəzi Bank" };
  if (t.includes("SEÇKİ KOMİSSİYA")) return { kind: "decision", institution: "Mərkəzi Seçki Komissiyası" };
  return { kind: "other", institution: typeName.trim() };
}

/** Institutions in issue order; others follow alphabetically. */
export function sortLeads(leads: Lead[]): Lead[] {
  const order = [MAJLIS, PRESIDENT, CABINET, CONST_COURT];
  const rank = (i: string) => (order.includes(i) ? order.indexOf(i) : order.length);
  return [...leads].sort(
    (a, b) =>
      rank(a.institution) - rank(b.institution) ||
      a.institution.localeCompare(b.institution, "az") ||
      a.date.localeCompare(b.date)
  );
}
