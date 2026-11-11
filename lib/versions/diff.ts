/**
 * Word-level comparison of two wordings, for track changes: what the later
 * one removed (struck, red) and added (green). Paragraph breaks are tokens
 * too, so a whole part added shows as one green block.
 */

export type DiffPiece = { kind: "same" | "del" | "ins"; text: string };

/** Words with the space before them attached; a paragraph break is its own token. */
function tokens(text: string): string[] {
  return text.match(/\n|[^\S\n]*[^\s]+/g) ?? [];
}

function key(token: string): string {
  return token.trim();
}

/** Longest common subsequence over tokens, as a list of pieces in reading order. */
export function diffWords(before: string, after: string): DiffPiece[] {
  const a = tokens(before);
  const b = tokens(after);
  // Trim the common head and tail so long unchanged articles stay cheap.
  let head = 0;
  while (head < a.length && head < b.length && key(a[head]) === key(b[head])) head++;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && key(a[a.length - 1 - tail]) === key(b[b.length - 1 - tail])) tail++;
  const am = a.slice(head, a.length - tail);
  const bm = b.slice(head, b.length - tail);
  const n = am.length;
  const m = bm.length;
  const table = new Uint32Array((n + 1) * (m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i * (m + 1) + j] =
        key(am[i]) === key(bm[j]) ? table[(i + 1) * (m + 1) + j + 1] + 1 : Math.max(table[(i + 1) * (m + 1) + j], table[i * (m + 1) + j + 1]);
    }
  }
  const pieces: DiffPiece[] = [];
  const push = (kind: DiffPiece["kind"], text: string) => {
    const last = pieces[pieces.length - 1];
    if (last && last.kind === kind) last.text += text;
    else pieces.push({ kind, text });
  };
  if (head) push("same", b.slice(0, head).join(""));
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && key(am[i]) === key(bm[j])) {
      push("same", bm[j]);
      i++;
      j++;
    } else if (j < m && (i === n || table[i * (m + 1) + j + 1] >= table[(i + 1) * (m + 1) + j])) {
      push("ins", bm[j]);
      j++;
    } else {
      push("del", am[i]);
      i++;
    }
  }
  if (tail) push("same", b.slice(b.length - tail).join(""));
  return regroup(pieces);
}

/** Puts each removal before the addition next to it, so a swap reads "old new". */
function regroup(pieces: DiffPiece[]): DiffPiece[] {
  const out: DiffPiece[] = [];
  for (let k = 0; k < pieces.length; k++) {
    const p = pieces[k];
    const next = pieces[k + 1];
    if (p.kind === "ins" && next?.kind === "del") {
      out.push(next, p);
      k++;
    } else out.push(p);
  }
  return out;
}

/** The pieces split at paragraph breaks, for rendering one paragraph per line. */
export function diffParagraphs(pieces: DiffPiece[]): DiffPiece[][] {
  const lines: DiffPiece[][] = [[]];
  for (const piece of pieces) {
    const parts = piece.text.split("\n");
    parts.forEach((part, k) => {
      if (k > 0) lines.push([]);
      if (part) lines[lines.length - 1].push({ kind: piece.kind, text: lines[lines.length - 1].length ? part : part.replace(/^\s+/, "") });
    });
  }
  return lines.filter((line) => line.length);
}

/** True when two wordings read the same once quotes, dashes and spacing are evened out. */
export function sameWording(a: string, b: string): boolean {
  return normalize(a) === normalize(b);
}

export function normalize(text: string): string {
  return text
    .normalize("NFC")
    .replace(/[«»“”„"]/g, '"')
    .replace(/[‘’`]/g, "'")
    .replace(/[–—−]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/ ([,.;:)])/g, "$1")
    .trim();
}
