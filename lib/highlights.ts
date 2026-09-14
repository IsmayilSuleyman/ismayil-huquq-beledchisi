/**
 * Highlights and notes inside a lesson. This module is pure (no DOM, no
 * database) so the anchoring logic can be unit-tested and shared by the
 * browser, the server actions and the PDF export.
 *
 * A highlight is anchored to the lesson text the way the W3C Web Annotation
 * model does it: the exact passage, a little context before and after it,
 * and the character offsets into the lesson's plain text at the time it was
 * made. Offsets are the fast path; the quote and its context let us find the
 * passage again when an edit to the lesson shifts the text.
 */

export const HIGHLIGHT_COLORS = ["yellow", "green", "blue", "pink"] as const;
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];

export const COLOR_LABELS: Record<HighlightColor, string> = {
  yellow: "Sarı",
  green: "Yaşıl",
  blue: "Mavi",
  pink: "Çəhrayı",
};

/** Longest passage a single highlight may cover (mirrors the DB check). */
export const MAX_EXACT = 5000;
/** Longest note (mirrors the DB check). */
export const MAX_NOTE = 4000;
/** Characters of context kept on each side of the passage. */
export const CONTEXT = 48;

export type TextAnchor = {
  exact: string;
  prefix: string;
  suffix: string;
  start: number;
  end: number;
};

export type Highlight = TextAnchor & {
  id: string;
  color: HighlightColor;
  note: string;
  createdAt: string;
};

export function isHighlightColor(value: unknown): value is HighlightColor {
  return typeof value === "string" && (HIGHLIGHT_COLORS as readonly string[]).includes(value);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isHighlightId(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

/**
 * Builds the anchor for the range [start, end) of `text`. Whitespace at
 * either end of the selection is dropped so a sloppy drag doesn't store a
 * trailing newline. Null when nothing but whitespace was selected or the
 * passage is longer than MAX_EXACT.
 */
export function anchorFromOffsets(text: string, start: number, end: number): TextAnchor | null {
  if (!Number.isInteger(start) || !Number.isInteger(end)) return null;
  let s = Math.max(0, Math.min(start, text.length));
  let e = Math.max(0, Math.min(end, text.length));
  while (s < e && /\s/.test(text[s])) s += 1;
  while (e > s && /\s/.test(text[e - 1])) e -= 1;
  if (s >= e) return null;
  const exact = text.slice(s, e);
  if (exact.length > MAX_EXACT) return null;
  return {
    exact,
    prefix: text.slice(Math.max(0, s - CONTEXT), s),
    suffix: text.slice(e, e + CONTEXT),
    start: s,
    end: e,
  };
}

/** Validates an anchor coming from the browser. */
export function isTextAnchor(value: unknown): value is TextAnchor {
  if (!value || typeof value !== "object") return false;
  const a = value as Record<string, unknown>;
  return (
    typeof a.exact === "string" &&
    a.exact.trim().length > 0 &&
    a.exact.length <= MAX_EXACT &&
    typeof a.prefix === "string" &&
    a.prefix.length <= CONTEXT &&
    typeof a.suffix === "string" &&
    a.suffix.length <= CONTEXT &&
    Number.isInteger(a.start) &&
    Number.isInteger(a.end) &&
    (a.start as number) >= 0 &&
    (a.end as number) > (a.start as number)
  );
}

function commonSuffixLength(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n += 1;
  return n;
}

function commonPrefixLength(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n += 1;
  return n;
}

/**
 * Finds where an anchor sits in `text` now.
 *
 * 1. If the stored offsets still frame the exact passage, use them.
 * 2. Otherwise look at every occurrence of the passage and score each by how
 *    much of the stored context still matches around it; the best score
 *    wins, and the occurrence closest to the old offset breaks ties.
 * 3. Null when the passage no longer appears (the lesson was rewritten).
 */
export function locateAnchor(
  text: string,
  anchor: TextAnchor,
): { start: number; end: number } | null {
  const { exact, prefix, suffix, start } = anchor;
  if (!exact) return null;
  if (text.slice(start, start + exact.length) === exact) {
    return { start, end: start + exact.length };
  }

  let best: { start: number; score: number; distance: number } | null = null;
  let from = 0;
  for (;;) {
    const i = text.indexOf(exact, from);
    if (i < 0) break;
    const before = text.slice(Math.max(0, i - prefix.length), i);
    const after = text.slice(i + exact.length, i + exact.length + suffix.length);
    const score = commonSuffixLength(before, prefix) + commonPrefixLength(after, suffix);
    const distance = Math.abs(i - start);
    if (!best || score > best.score || (score === best.score && distance < best.distance)) {
      best = { start: i, score, distance };
    }
    from = i + 1;
  }
  return best ? { start: best.start, end: best.start + exact.length } : null;
}

export type NodeSlice = { index: number; from: number; to: number };

/**
 * Splits the range [start, end) over a run of text nodes with the given
 * lengths into one slice per node it touches (offsets local to that node).
 * Nodes the range only grazes with zero length are skipped.
 */
export function sliceOverNodes(lengths: number[], start: number, end: number): NodeSlice[] {
  const out: NodeSlice[] = [];
  let pos = 0;
  for (let index = 0; index < lengths.length; index += 1) {
    const len = lengths[index];
    const nodeStart = pos;
    const nodeEnd = pos + len;
    pos = nodeEnd;
    if (nodeEnd <= start) continue;
    if (nodeStart >= end) break;
    const from = Math.max(start, nodeStart) - nodeStart;
    const to = Math.min(end, nodeEnd) - nodeStart;
    if (to > from) out.push({ index, from, to });
  }
  return out;
}

/** Shortens a passage for lists and the PDF appendix. */
export function excerpt(text: string, max = 180): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${space > max * 0.6 ? cut.slice(0, space) : cut}…`;
}

/** Keeps a list sorted by position in the text, then by creation time. */
export function sortHighlights<T extends Pick<Highlight, "start" | "createdAt">>(list: T[]): T[] {
  return [...list].sort(
    (a, b) => a.start - b.start || a.createdAt.localeCompare(b.createdAt),
  );
}
