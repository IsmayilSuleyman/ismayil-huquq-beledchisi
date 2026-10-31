/**
 * The inline marks a summary's text carries, as the summariser writes them:
 * **bold**, __underline__ and *italic*, nestable (**__both__**). Elgun's
 * emails use exactly these three emphases (scripts/summaries/STYLE.md,
 * step 5), so a bullet is stored as one string with the marks inside, and
 * the page (components/gazette/SummaryBody.tsx) and the Word file
 * (scripts/summaries/docx.ts) both render it from the spans here.
 *
 * A single "_" is ordinary text (it never occurs in the Court's prose
 * anyway); a backslash escapes a mark: "\*" is a literal asterisk.
 */

export type Span = { text: string; bold: boolean; underline: boolean; italic: boolean };

type Mark = "bold" | "underline" | "italic";

const MARKS: [string, Mark][] = [
  ["**", "bold"],
  ["__", "underline"],
  ["*", "italic"],
];

/** Splits marked text into runs of uniform emphasis. Unclosed marks run to the end. */
export function parseMarks(text: string): Span[] {
  const spans: Span[] = [];
  const state = { bold: false, underline: false, italic: false };
  let buffer = "";

  const flush = () => {
    if (buffer) spans.push({ text: buffer, ...state });
    buffer = "";
  };

  for (let i = 0; i < text.length; ) {
    if (text[i] === "\\" && i + 1 < text.length && "*_\\".includes(text[i + 1])) {
      buffer += text[i + 1];
      i += 2;
      continue;
    }
    const mark = MARKS.find(([token]) => text.startsWith(token, i));
    if (!mark) {
      buffer += text[i];
      i++;
      continue;
    }
    flush();
    state[mark[1]] = !state[mark[1]];
    i += mark[0].length;
  }
  flush();
  return spans;
}

/** The text without its marks, for search and previews. */
export function plainText(text: string): string {
  return parseMarks(text)
    .map((s) => s.text)
    .join("");
}

/** Why the marks in `text` don't balance, or null when they do. */
export function unbalancedMarks(text: string): string | null {
  const open: Record<Mark, boolean> = { bold: false, underline: false, italic: false };
  for (let i = 0; i < text.length; ) {
    if (text[i] === "\\" && i + 1 < text.length) {
      i += 2;
      continue;
    }
    const mark = MARKS.find(([token]) => text.startsWith(token, i));
    if (mark) {
      open[mark[1]] = !open[mark[1]];
      i += mark[0].length;
    } else i++;
  }
  const left = (Object.keys(open) as Mark[]).filter((m) => open[m]);
  if (left.length === 0) return null;
  const token = (m: Mark) => MARKS.find(([, name]) => name === m)![0];
  return `${left.map((m) => `${m} (${token(m)})`).join(", ")} not closed`;
}
