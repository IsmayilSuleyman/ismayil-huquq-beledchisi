/**
 * Steps an article back through its amendments: given the article as it
 * stood after an amending act, and the act's operations on it, returns the
 * article as it stood before.
 *
 * The consolidated text marks what amendments did (MARK in eqanun-html.ts):
 * added words are italic and removed words are still there, struck through.
 * So undoing an operation means finding its words in the right part,
 * preferring marked ones: an added word is taken out, a replaced word put
 * back, a struck word restored. A unit given a new wording gets the old
 * wording the endnote quotes. Where neither the text nor the note says what
 * stood there before (a 2002 change e-qanun did not annotate), the old
 * wording comes from a witness: the original text as published.
 */

import type { Op, Scope } from "@/scripts/versions/changes";
import { MARK, stripMarks, tidy } from "@/scripts/versions/eqanun-html";

export type Snapshot = { title: string; paragraphs: string[] };

/** The text an operation needs but neither the article nor the note gives. */
export type Witness = Snapshot;

export class RebuildError extends Error {}

const ROMAN_VALUE: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100 };

export function romanValue(label: string): number {
  let total = 0;
  for (let i = 0; i < label.length; i++) {
    const v = ROMAN_VALUE[label[i]] ?? 0;
    const next = ROMAN_VALUE[label[i + 1]] ?? 0;
    total += v < next ? -v : v;
  }
  return total;
}

const LEAD = "[\\uE000-\\uE003\\s]*";

/** The part label ("II") a paragraph starts with, if any. */
export function partLabel(paragraph: string): string | null {
  const m = /^([IVXL]+)\.\s/.exec(stripMarks(paragraph).trim());
  return m ? m[1] : null;
}

/** The item label ("6") a paragraph starts with, if any. */
export function itemLabel(paragraph: string): string | null {
  const m = /^(\d+)\)\s/.exec(stripMarks(paragraph).trim());
  return m ? m[1] : null;
}

function fail(article: string, op: Op, why: string): never {
  throw new RebuildError(`Article ${article}, ${op.kind}: ${why}`);
}

/** [start, end) of the paragraphs a part covers; the whole article when it has no parts. */
function partRange(paragraphs: string[], label: string | undefined): [number, number] | null {
  if (!label) return [0, paragraphs.length];
  const start = paragraphs.findIndex((p) => partLabel(p) === label);
  if (start < 0) {
    // "109-cu maddənin I hissəsində": an article without parts is its own part I.
    return paragraphs.some((p) => partLabel(p)) ? null : [0, paragraphs.length];
  }
  let end = start + 1;
  while (end < paragraphs.length && !partLabel(paragraphs[end])) end++;
  return [start, end];
}

/** The ranges an op's scope covers, narrowest first; a wider fallback when the narrow one misses. */
function ranges(snap: Snapshot, scope: Scope): [number, number][] {
  const parts = scope.parts?.length ? scope.parts : [undefined];
  const out: [number, number][] = [];
  for (const label of parts) {
    const range = partRange(snap.paragraphs, label);
    if (!range) continue;
    const items = scope.items ?? (scope.item ? [scope.item] : null);
    if (items) {
      for (const item of items) {
        const i = snap.paragraphs.findIndex((p, k) => k >= range[0] && k < range[1] && itemLabel(p) === item);
        if (i >= 0) out.push([i, i + 1]);
      }
    } else if (scope.paragraph) {
      const i = range[0] + scope.paragraph - 1;
      if (i < range[1]) out.push([i, i + 1]);
    } else out.push(range);
  }
  return out;
}

// The label and the space after it; an opening mark after the label belongs to the sentence.
const LABEL_RE = new RegExp(`^${LEAD}(?:[IVXL]+${LEAD}\\.|\\d+${LEAD}\\))[\\s\\uE001\\uE003]*`);

/** A paragraph's leading label ("IV. ", "6) ") and its sentences. */
function sentences(paragraph: string): { label: string; parts: string[] } {
  const label = LABEL_RE.exec(paragraph)?.[0] ?? "";
  const parts = paragraph.slice(label.length).split(/(?<=[.!?][]?)\s+(?=[-]*[A-ZƏÜÖÇŞĞİI"“«(])/);
  return { label, parts };
}

function joinSentences(s: { label: string; parts: string[] }): string {
  return s.label + s.parts.join(" ");
}

/** Index of `needle` in `hay` ignoring case (Azerbaijani rules, so lengths match), or -1. */
function indexOfAnyCase(hay: string, needle: string, from = 0): number {
  return hay.toLocaleLowerCase("az").indexOf(needle.toLocaleLowerCase("az"), from);
}

/** Replaces the first match of `needle` in `hay` (or every match) and reports how many. */
function swap(hay: string, needle: string, by: string, all: boolean): [string, number] {
  if (!needle) return [hay, 0];
  let count = 0;
  let out = "";
  let from = 0;
  for (;;) {
    const i = hay.indexOf(needle, from);
    if (i < 0) break;
    out += hay.slice(from, i) + by;
    from = i + needle.length;
    count++;
    if (!all) break;
  }
  return [out + hay.slice(from), count];
}

/** Variants of a quoted string as it may sit in the text: marked, plain, first letter in the other case. */
function variants(words: string, open: string, close: string): string[] {
  const other = words[0] === words[0]?.toUpperCase() ? words[0].toLowerCase() + words.slice(1) : words[0]?.toUpperCase() + words.slice(1);
  const trimmed = words.replace(/^[,\s]+|[,\s]+$/g, "");
  return [...new Set([`${open}${words}${close}`, `${open}${words.trim()}${close}`, `${open}${trimmed}${close}`, `${open}${other}${close}`])];
}

/** Applies `edit` to the text of each range (paragraphs joined by \n) until one changes; returns whether any did. */
function editIn(snap: Snapshot, rs: [number, number][], edit: (text: string) => string): boolean {
  let changed = false;
  for (const [a, b] of [...rs].reverse()) {
    const text = snap.paragraphs.slice(a, b).join("\n");
    const next = edit(text);
    if (next !== text) {
      snap.paragraphs.splice(a, b - a, ...next.split("\n"));
      changed = true;
    }
  }
  return changed;
}

function clean(text: string): string {
  return tidy(text.replace(/|/g, ""));
}

/** Drops marker characters around a part or item label ("II. …" → "II. …"). */
function relabel(paragraph: string, from: string, to: string, kind: "part" | "item"): string {
  const sep = kind === "part" ? "\\." : "\\)";
  const re = new RegExp(`^${LEAD}${from}${LEAD}${sep}${LEAD}`);
  return paragraph.replace(re, `${to}${kind === "part" ? "." : ")"} `);
}

/**
 * Undoes one operation on a snapshot (in place). `witness` is the article
 * as it stood before the act, as published, for what the act does not quote.
 */
export function undo(snap: Snapshot, op: Op, witness?: Witness): void {
  const article = op.scope.article;
  const scope = op.scope;
  switch (op.kind) {
    case "replace": {
      if (scope.title) {
        const done = variants(op.new, MARK.addOpen, MARK.addClose).concat(variants(op.new, "", "")).some((v) => {
          const [t, n] = swap(snap.title, v, op.old, true);
          if (n) snap.title = t;
          return n > 0;
        });
        if (!done) fail(article, op, `"${op.new}" not in the title`);
        return;
      }
      const wide = ranges(snap, { article, parts: scope.parts });
      // A paragraph or item the act counts differently from the text: look in the whole part.
      const narrow = ranges(snap, scope).length ? ranges(snap, scope) : wide;
      // The old words as the published text prints them, when it differs only in capitals.
      const printed = witness?.paragraphs
        .map((p) => {
          const i = indexOfAnyCase(p, op.old);
          return i >= 0 ? p.slice(i, i + op.old.length) : null;
        })
        .find((x) => x && x !== op.old && x.toLocaleLowerCase("az") === op.old.toLocaleLowerCase("az"));
      const oldWords = printed ?? op.old;
      if (scope.sentence && narrow.length) {
        // Narrow to the sentence of the unit's first paragraph.
        const [a] = narrow[0];
        const s = sentences(snap.paragraphs[a]);
        const k = scope.sentence - 1;
        if (s.parts[k] !== undefined) {
          for (const v of [...variants(op.new, MARK.addOpen, MARK.addClose), ...variants(op.new, "", "")]) {
            const [t, n] = swap(s.parts[k], v, oldWords, true);
            if (n) {
              s.parts[k] = t;
              snap.paragraphs[a] = joinSentences(s);
              return;
            }
          }
        }
      }
      const marked = variants(op.new, MARK.addOpen, MARK.addClose);
      const plain = variants(op.new, "", "");
      // Marked words in the unit, then plain words in the unit, then marked words in the part.
      for (const [rs, vs] of [[narrow, marked], [narrow, plain], [wide, marked]] as const) {
        for (const v of vs) if (editIn(snap, rs, (t) => swap(t, v, oldWords, true)[0])) return;
      }
      // Last, the words in any case ("baş naziri" quoted, "Baş naziri" in the text).
      const anyCase = (t: string) => {
        let out = t;
        for (let i = indexOfAnyCase(out, op.new); i >= 0; i = indexOfAnyCase(out, op.new, i + oldWords.length)) {
          out = out.slice(0, i) + oldWords + out.slice(i + op.new.length);
        }
        return out;
      };
      if (editIn(snap, narrow, anyCase)) return;
      fail(article, op, `"${op.new}" not found`);
      return;
    }
    case "insert": {
      const rs = ranges(snap, scope);
      const lead = /^[,.;:)]/.test(op.words) ? "" : " ";
      for (const v of variants(op.words, MARK.addOpen, MARK.addClose)) {
        if (editIn(snap, rs, (t) => swap(t, `${lead}${v}`, "", true)[0])) return;
        if (editIn(snap, rs, (t) => swap(t, v, "", true)[0])) return;
      }
      if (editIn(snap, rs, (t) => swap(t, `${op.after}${lead}${op.words}`, op.after, true)[0])) return;
      fail(article, op, `"${op.words}" not found after "${op.after}"`);
      return;
    }
    case "remove": {
      const rs = ranges(snap, scope).length ? ranges(snap, scope) : [[0, snap.paragraphs.length] as [number, number]];
      // The consolidated text keeps removed words, struck through.
      for (const v of variants(op.words, MARK.delOpen, MARK.delClose)) {
        if (editIn(snap, rs, (t) => swap(t, v, op.words.trim(), true)[0])) return;
      }
      // Otherwise the witness shows where they stood: find the words before them in its paragraph.
      const words = op.words.trim();
      const para = witness?.paragraphs.find((p) => indexOfAnyCase(p, words) >= 0);
      if (!para) fail(article, op, `"${op.words}" is not struck in the text and not in the witness`);
      const at = indexOfAnyCase(para, words);
      const asPrinted = para.slice(at, at + words.length);
      const before = para.slice(0, at).trimEnd().split(/[ \t]+/).filter(Boolean);
      for (let k = Math.min(4, before.length); k >= 1; k--) {
        const anchor = before.slice(-k).join(" ");
        const put = (t: string) => {
          const i = t.indexOf(anchor);
          if (i < 0) return t;
          let rest = t.slice(i + anchor.length);
          // "III. Yalnız müharibə": a word that opened the sentence takes the capital back.
          if (asPrinted[0] !== asPrinted[0].toLocaleLowerCase("az")) rest = rest.replace(/^(\s*)(\S)/, (_, sp: string, c: string) => sp + c.toLocaleLowerCase("az"));
          return `${t.slice(0, i)}${anchor} ${asPrinted}${rest}`;
        };
        if (editIn(snap, rs, put)) return;
      }
      fail(article, op, `no place found for "${op.words}"`);
      return;
    }
    case "addWords": {
      const rs = ranges(snap, scope);
      if (!editIn(snap, rs, (t) => t.replace(/\s?[^-]*/g, ""))) fail(article, op, "no italic words in scope");
      return;
    }
    case "addParts": {
      for (const label of op.labels) {
        const range = partRange(snap.paragraphs, label);
        if (!range || !snap.paragraphs.some((p) => partLabel(p) === label)) fail(article, op, `part ${label} not found`);
        snap.paragraphs.splice(range[0], range[1] - range[0]);
      }
      return;
    }
    case "addItems": {
      const [a, b] = partRange(snap.paragraphs, scope.parts?.[0]) ?? fail(article, op, "part not found");
      for (const label of op.labels) {
        const i = snap.paragraphs.findIndex((p, k) => k >= a && k < b && itemLabel(p) === label);
        if (i < 0) fail(article, op, `item ${label} not found`);
        snap.paragraphs.splice(i, 1);
      }
      return;
    }
    case "addSentence": {
      const [a] = ranges(snap, { article, parts: scope.parts })[0] ?? fail(article, op, "unit not found");
      const s = sentences(snap.paragraphs[a]);
      if (s.parts.length < 2) fail(article, op, "the unit has one sentence");
      // The added words are the italic run that starts a sentence after the first and ends one;
      // it may hold more than one sentence (84 I, 2009: "cümlə", two sentences in italics).
      const body = s.parts.join(" ");
      const runs = [...body.matchAll(/(^|\s)([^-]*)/g)].filter(
        (m) => (m.index ?? 0) > 0 && /[.;!?]$/.test(m[2].trim()) && /[.;!?][]?\s*$/.test(body.slice(0, m.index ?? 0) + " "),
      );
      if (runs.length) {
        const byOrdinal = op.ordinal ? runs.find((m) => sentences(body.slice(0, m.index)).parts.length === op.ordinal! - 1) : undefined;
        const run = byOrdinal ?? runs[runs.length - 1];
        snap.paragraphs[a] = s.label + (body.slice(0, run.index) + body.slice((run.index ?? 0) + run[0].length)).trim();
        return;
      }
      // No italics: the sentence the note counts, else the last.
      const k = op.ordinal ? op.ordinal - 1 : s.parts.length - 1;
      s.parts.splice(k, 1);
      snap.paragraphs[a] = joinSentences(s);
      return;
    }
    case "newText": {
      const old = op.old?.length ? op.old : null;
      if (scope.whole) {
        const lines = old ?? (witness ? [`Maddə ${article}. ${witness.title}`, ...witness.paragraphs] : fail(article, op, "no old wording"));
        snap.title = lines[0].replace(/^Maddə\s+[\d-]+\.\s*/, "");
        snap.paragraphs = lines.slice(1);
        return;
      }
      if (scope.title) {
        snap.title = old?.[0] ?? witness?.title ?? fail(article, op, "no old title");
        return;
      }
      if (scope.sentence) {
        const [a] = ranges(snap, { article, parts: scope.parts })[0] ?? fail(article, op, "unit not found");
        const s = sentences(snap.paragraphs[a]);
        s.parts[scope.sentence - 1] = old?.[0] ?? fail(article, op, "no old sentence");
        snap.paragraphs[a] = joinSentences(s);
        return;
      }
      const items = scope.items ?? (scope.item ? [scope.item] : null);
      if (items) {
        // An act that gives items a new wording quotes the new ones only: the old come from the witness.
        for (const item of items) {
          const rs = ranges(snap, { article, parts: scope.parts, item });
          if (!rs.length) fail(article, op, `item ${item} not found`);
          const was = witness?.paragraphs.find((p) => itemLabel(p) === item);
          if (!was) fail(article, op, `item ${item} not in the witness`);
          snap.paragraphs[rs[0][0]] = was;
        }
        return;
      }
      const rs = scope.parts?.length ? ranges(snap, scope) : [[0, snap.paragraphs.length] as [number, number]];
      if (!rs.length) fail(article, op, "unit not found");
      let lines = old;
      if (!lines && witness) {
        const range = scope.parts?.length ? partRange(witness.paragraphs, scope.parts[0]) : [0, witness.paragraphs.length];
        if (range) lines = witness.paragraphs.slice(range[0], range[1]);
      }
      if (!lines) fail(article, op, "no old wording");
      snap.paragraphs.splice(rs[0][0], rs[0][1] - rs[0][0], ...lines);
      return;
    }
    case "rename": {
      snap.title = witness?.title ?? fail(article, op, "the old title is in neither the note nor the witness");
      return;
    }
    case "renumberParts": {
      const back = new Map(op.to.map((t, i) => [t, op.from[i]]));
      snap.paragraphs = snap.paragraphs.map((p) => {
        const label = partLabel(p);
        return label && back.has(label) ? relabel(p, label, back.get(label)!, "part") : p;
      });
      return;
    }
    case "renumberItems": {
      const [a, b] = partRange(snap.paragraphs, scope.parts?.[0]) ?? fail(article, op, "part not found");
      const back = new Map(op.to.map((t, i) => [t, op.from[i]]));
      // Renumber from the highest label down so 7→8 does not meet a fresh 8.
      for (let k = b - 1; k >= a; k--) {
        const label = itemLabel(snap.paragraphs[k]);
        if (label && back.has(label)) snap.paragraphs[k] = relabel(snap.paragraphs[k], label, back.get(label)!, "item");
      }
      return;
    }
    case "textToPart": {
      const i = snap.paragraphs.findIndex((p) => partLabel(p) === op.label);
      if (i < 0) fail(article, op, `part ${op.label} not found`);
      snap.paragraphs[i] = snap.paragraphs[i].replace(new RegExp(`^${LEAD}${op.label}${LEAD}\\.${LEAD}`), "");
      return;
    }
    case "removeItems": {
      const [a, b] = partRange(snap.paragraphs, scope.parts?.[0]) ?? fail(article, op, "part not found");
      const was = witness ?? fail(article, op, "removed items need the witness");
      const [wa, wb] = partRange(was.paragraphs, scope.parts?.[0]) ?? fail(article, op, "part not in the witness");
      for (const label of op.labels) {
        const old = was.paragraphs.slice(wa, wb).find((p) => itemLabel(p) === label) ?? fail(article, op, `item ${label} not in the witness`);
        // Put it back after the last item with a lower number (before any closing paragraph of the part).
        let at = -1;
        for (let k = a; k < b; k++) {
          const l = itemLabel(snap.paragraphs[k]);
          if (l && Number(l) < Number(label)) at = k + 1;
          if (l && Number(l) > Number(label) && at < 0) at = k;
        }
        snap.paragraphs.splice(at < 0 ? b : at, 0, old);
      }
      return;
    }
    case "removeParagraphs": {
      const [a] = partRange(snap.paragraphs, scope.parts?.[0]) ?? fail(article, op, "part not found");
      const was = witness ?? fail(article, op, "removed paragraphs need the witness");
      const [wa] = partRange(was.paragraphs, scope.parts?.[0]) ?? fail(article, op, "part not in the witness");
      const sorted = [...op.paragraphs].sort((x, y) => x - y);
      const restored = sorted.map((n) => was.paragraphs[wa + n - 1]);
      // They go before the paragraph that followed them, which the text may have run into the one before.
      const next = was.paragraphs[wa + sorted[sorted.length - 1]];
      const anchor = next ? stripMarks(next).split(/\s+/).slice(0, 6).join(" ") : "";
      const end = partRange(snap.paragraphs, scope.parts?.[0])?.[1] ?? a + 1;
      for (let k = a; anchor && k < end; k++) {
        const i = snap.paragraphs[k].indexOf(anchor);
        if (i < 0) continue;
        const head = snap.paragraphs[k].slice(0, i).trimEnd();
        const tail = snap.paragraphs[k].slice(i);
        snap.paragraphs.splice(k, 1, ...(head ? [head] : []), ...restored, tail);
        return;
      }
      snap.paragraphs.splice(a + sorted[0] - 1, 0, ...restored);
      return;
    }
    case "endPunctuation": {
      const rs = ranges(snap, scope);
      if (!rs.length) fail(article, op, "item not found");
      const i = rs[0][0];
      const p = snap.paragraphs[i];
      const at = p.lastIndexOf(op.new);
      if (at < 0) fail(article, op, `no "${op.new}" at the end`);
      snap.paragraphs[i] = p.slice(0, at) + op.old + p.slice(at + op.new.length);
      return;
    }
    case "addArticle":
      // Handled by the caller: before the act, the article did not exist.
      return;
  }
}

/** The snapshot as text people read: struck words dropped, markers removed. */
export function readable(snap: Snapshot): Snapshot {
  const now = (t: string) => tidy(t.replace(/[^]*/g, "").replace(/[-]/g, ""));
  return { title: now(snap.title), paragraphs: snap.paragraphs.map(now).filter(Boolean) };
}

export function copy(snap: Snapshot): Snapshot {
  return { title: snap.title, paragraphs: [...snap.paragraphs] };
}

export { clean as cleanMarked };
