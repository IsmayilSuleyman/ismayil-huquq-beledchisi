/**
 * Browser-side half of highlighting: turns a selection into text offsets and
 * wraps the matching text in <mark> elements. Works on the rendered lesson
 * DOM without re-rendering it, so React's tree is left alone (text nodes may
 * be split, never removed).
 *
 * Offsets count characters of `root.textContent` in document order, the same
 * measure `Range.toString()` uses, so the two agree without a custom walker.
 */

import { sliceOverNodes, type HighlightColor } from "@/lib/highlights";

export const MARK_ATTR = "data-hl";

export function rootText(root: HTMLElement): string {
  return root.textContent ?? "";
}

/**
 * Character offsets of a selection range inside `root`, clipped to the root's
 * own contents. Null when the clipped range is empty.
 */
export function offsetsFromRange(
  root: HTMLElement,
  range: Range,
): { start: number; end: number } | null {
  const whole = document.createRange();
  whole.selectNodeContents(root);
  const r = range.cloneRange();
  if (r.compareBoundaryPoints(Range.START_TO_START, whole) < 0) {
    r.setStart(root, 0);
  }
  if (r.compareBoundaryPoints(Range.END_TO_END, whole) > 0) {
    r.setEnd(root, root.childNodes.length);
  }
  // compareBoundaryPoints(how, other) compares THIS range's point named
  // second in `how` with OTHER's point named first: START_TO_END is this.end
  // against other.start.
  if (r.compareBoundaryPoints(Range.START_TO_END, whole) < 0) return null; // ends before root starts
  if (r.compareBoundaryPoints(Range.END_TO_START, whole) > 0) return null; // starts after root ends
  if (r.collapsed) return null;

  const before = document.createRange();
  before.selectNodeContents(root);
  before.setEnd(r.startContainer, r.startOffset);
  const start = before.toString().length;
  const end = start + r.toString().length;
  return end > start ? { start, end } : null;
}

function textNodes(root: HTMLElement): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let n = walker.nextNode();
  while (n) {
    nodes.push(n as Text);
    n = walker.nextNode();
  }
  return nodes;
}

function styleMark(mark: HTMLElement, color: HighlightColor, hasNote: boolean) {
  mark.className = `hl hl-${color}`;
  if (hasNote) mark.setAttribute("data-note", "1");
  else mark.removeAttribute("data-note");
}

/**
 * Wraps the text between `start` and `end` in <mark> elements (one per text
 * node touched). Whitespace-only fragments between blocks are left alone.
 * Returns the marks made; an empty array means nothing was wrapped.
 */
export function applyHighlight(
  root: HTMLElement,
  id: string,
  start: number,
  end: number,
  color: HighlightColor,
  hasNote: boolean,
): HTMLElement[] {
  const nodes = textNodes(root);
  const slices = sliceOverNodes(
    nodes.map((n) => n.data.length),
    start,
    end,
  );
  const marks: HTMLElement[] = [];
  for (const { index, from, to } of slices) {
    let target = nodes[index];
    if (!/\S/.test(target.data.slice(from, to))) continue;
    if (to < target.data.length) target.splitText(to);
    if (from > 0) target = target.splitText(from);
    const mark = document.createElement("mark");
    mark.setAttribute(MARK_ATTR, id);
    styleMark(mark, color, hasNote);
    target.parentNode?.insertBefore(mark, target);
    mark.appendChild(target);
    marks.push(mark);
  }
  if (marks[0]) {
    marks[0].setAttribute("tabindex", "0");
    marks[0].setAttribute("role", "button");
    marks[0].setAttribute("aria-label", hasNote ? "İşarələnmiş mətn, qeydi var" : "İşarələnmiş mətn");
  }
  return marks;
}

export function marksOf(root: HTMLElement, id: string): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(`mark[${MARK_ATTR}="${CSS.escape(id)}"]`));
}

/** Unwraps the marks of one highlight, leaving the text where it was. */
export function removeHighlight(root: HTMLElement, id: string): void {
  for (const mark of marksOf(root, id)) {
    const parent = mark.parentNode;
    if (!parent) continue;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
  }
}

/** Unwraps every mark (used when the component unmounts). */
export function removeAllHighlights(root: HTMLElement): void {
  for (const mark of Array.from(root.querySelectorAll<HTMLElement>(`mark[${MARK_ATTR}]`))) {
    const parent = mark.parentNode;
    if (!parent) continue;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
  }
}

export function restyleHighlight(
  root: HTMLElement,
  id: string,
  color: HighlightColor,
  hasNote: boolean,
): void {
  const marks = marksOf(root, id);
  marks.forEach((m) => styleMark(m, color, hasNote));
  if (marks[0]) {
    marks[0].setAttribute("aria-label", hasNote ? "İşarələnmiş mətn, qeydi var" : "İşarələnmiş mətn");
  }
}

/** Gives a highlight its permanent id once the server has assigned one. */
export function renameHighlight(root: HTMLElement, from: string, to: string): void {
  marksOf(root, from).forEach((m) => m.setAttribute(MARK_ATTR, to));
}

/** Scrolls the first mark of a highlight into view and flashes it. */
export function revealHighlight(root: HTMLElement, id: string): boolean {
  const marks = marksOf(root, id);
  const first = marks[0];
  if (!first) return false;
  first.scrollIntoView({ block: "center", behavior: "smooth" });
  for (const m of marks) {
    m.classList.remove("hl-flash");
    void m.offsetWidth; // restart the animation
    m.classList.add("hl-flash");
  }
  return true;
}

/** Viewport rectangles of a highlight's first and last fragment, for anchoring a popover. */
export function highlightRects(
  root: HTMLElement,
  id: string,
): { first: DOMRect; last: DOMRect } | null {
  const marks = marksOf(root, id);
  if (marks.length === 0) return null;
  return {
    first: marks[0].getBoundingClientRect(),
    last: marks[marks.length - 1].getBoundingClientRect(),
  };
}
