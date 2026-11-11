/**
 * Reads an act's consolidated text as e-qanun.az serves it: a Word document
 * saved as HTML (div.WordSection1), followed by its endnotes. Words an
 * amendment added are in italics, words it removed are struck through, and
 * each amended place carries a link to the endnote (#_ednN) that names the
 * amending act and, for a clause given a new wording, quotes the old one.
 *
 * `cleanEqanunHtml` cuts the act out of the saved page and keeps only the
 * markup the parser needs, so the committed source is small and readable.
 * `parseEqanun` turns it into blocks of text in which italic and struck
 * runs are kept as private-use marker characters (MARK).
 */

/** Marker characters for italic (added) and struck (removed) runs inside a paragraph's text. */
export const MARK = {
  addOpen: "",
  addClose: "",
  delOpen: "",
  delClose: "",
} as const;

const MARKS_RE = /[-]/g;

/** The text without markers, struck runs included. */
export function stripMarks(text: string): string {
  return text.replace(MARKS_RE, "");
}

/** The text as it reads now: struck runs dropped, markers removed. */
export function readNow(text: string): string {
  return tidy(text.replace(/[^]*/g, "").replace(MARKS_RE, ""));
}

/** Collapses runs of spaces and trims; leaves line breaks alone. */
export function tidy(text: string): string {
  return text
    .replace(/[ \t ]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/ ([,.;:)])/g, "$1")
    .replace(/\( /g, "(")
    .trim();
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decode(text: string): string {
  return text
    // Some words carry the Cyrillic schwa (ә, U+04D9) for the Latin one (ə).
    .replace(/ә/g, "ə")
    .replace(/Ә/g, "Ə")
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : whole;
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

/**
 * The act's own HTML out of a saved e-qanun page (or an already cleaned
 * file, which passes through unchanged): comments, styles and Office tags
 * removed, attributes dropped except an endnote link's number, a block's
 * tag and an endnote container's id.
 */
export function cleanEqanunHtml(raw: string): string {
  let html = raw;
  if (!html.startsWith("<!-- e-qanun act -->")) {
    const start = html.search(/<div[^>]*class="?WordSection1/);
    if (start < 0) throw new Error("No WordSection1 in the page: is this an e-qanun act page?");
    html = html.slice(start);
    // The act ends where the site's own page resumes after the endnote list.
    const end = html.search(/(Qüvvədədir|Qüvvədən düşüb)\s*<\/(div|span|p)>/);
    if (end > 0) html = html.slice(0, end);
  }
  html = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(style|script|xml)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/<\/?(o|st1|v|w):[^>]*>/gi, "")
    .replace(/<img\b[^>]*>/gi, "");
  // Keep endnote links as {ref:N} and endnote anchors as {note:N}.
  html = html
    .replace(/<a\b[^>]*href="#_edn(\d+)"[^>]*>[\s\S]*?<\/a>/gi, "<ref n=\"$1\"></ref>")
    // An endnote's own anchor holds its label ("[12]", "KM1"); keep the text.
    .replace(/<a\b[^>]*href="#_ednref\d+"[^>]*>([\s\S]*?)<\/a>/gi, "$1")
    .replace(/<div\b[^>]*id="edn(\d+)"[^>]*>/gi, "<note n=\"$1\">");
  // Drop every remaining tag except the ones the parser reads, and their attributes.
  html = html.replace(/<(\/?)([a-z][a-z0-9]*)\b([^>]*)>/gi, (whole, close: string, tag: string, attrs: string) => {
    const t = tag.toLowerCase();
    if (t === "ref") return whole;
    if (t === "note") return close ? "</note>" : whole;
    if (t === "div") return close ? "</div>" : "<div>";
    if (["p", "h1", "h2", "h3", "h4", "h5", "h6"].includes(t)) return `<${close}${t}>`;
    if (["i", "em"].includes(t)) return `<${close}i>`;
    if (["s", "strike", "del"].includes(t)) return `<${close}s>`;
    if (["b", "strong"].includes(t)) return `<${close}b>`;
    if (t === "sup") return `<${close}sup>`;
    if (t === "br") return "<br>";
    void attrs;
    return "";
  });
  html = html
    .replace(/[ \t\r]+/g, " ")
    .replace(/ ?\n ?/g, " ")
    .replace(/<(i|s|b|sup)>(\s*)<\/\1>/g, "$2")
    .replace(/<\/(i|s|b)>(\s*)<\1>/g, "$2")
    .replace(/<(p|h[1-6])>\s*/g, "\n<$1>")
    .replace(/<note /g, "\n<note ")
    .trim();
  return `<!-- e-qanun act -->\n${html}\n`;
}

export type Block = {
  /** "p" or "h1".."h6". */
  tag: string;
  /** Text with MARK characters around italic and struck runs. */
  text: string;
  /** Endnotes this block links to, in order. */
  refs: number[];
  bold: boolean;
};

export type Endnote = { n: number; label: string; text: string; blocks: Block[] };

export type EqanunDoc = { body: Block[]; endnotes: Endnote[] };

/** Reads one block's inline markup into text with markers. */
function readInline(inner: string): { text: string; refs: number[]; bold: boolean } {
  let text = "";
  const refs: number[] = [];
  let italic = 0;
  let struck = 0;
  let sup = 0;
  let boldChars = 0;
  let bold = 0;
  let chars = 0;
  const tokens = inner.split(/(<[^>]+>)/);
  const open = () => {
    // Struck wins over italic: a struck word is a removed word.
    if (struck > 0) return MARK.delOpen;
    if (italic > 0) return MARK.addOpen;
    return "";
  };
  let state = "";
  const setState = () => {
    const next = open();
    if (next === state) return;
    if (state === MARK.addOpen) text += MARK.addClose;
    if (state === MARK.delOpen) text += MARK.delClose;
    text += next;
    state = next;
  };
  for (const token of tokens) {
    if (!token) continue;
    if (token[0] === "<") {
      const m = /^<(\/?)([a-z0-9]+)(?:\s+n="(\d+)")?/i.exec(token);
      if (!m) continue;
      const [, close, tag, n] = m;
      const d = close ? -1 : 1;
      if (tag === "i") italic += d;
      else if (tag === "s") struck += d;
      else if (tag === "b") bold += d;
      else if (tag === "sup") sup += d;
      else if (tag === "br") text += "\n";
      else if (tag === "ref" && !close && n) refs.push(Number(n));
      continue;
    }
    let piece = decode(token);
    // "98<sup>1</sup>" is article 98-1.
    if (sup > 0 && /^\d+$/.test(piece.trim()) && /\d$/.test(stripMarks(text))) piece = `-${piece.trim()}`;
    setState();
    text += piece;
    const visible = piece.replace(/\s/g, "").length;
    chars += visible;
    if (bold > 0) boldChars += visible;
  }
  italic = 0;
  struck = 0;
  setState();
  // Markers around nothing but spaces carry no change.
  text = text
    .replace(/(\s*)/g, "$1")
    .replace(/(\s*)/g, "$1")
    .replace(/(\s*)/g, "$1")
    .replace(/(\s*)/g, "$1");
  return { text: tidyMarked(text), refs, bold: chars > 0 && boldChars >= chars * 0.6 };
}

/** tidy() that keeps a space outside a marker rather than inside it. */
function tidyMarked(text: string): string {
  return tidy(
    text
      .replace(/([])\s+/g, " $1")
      .replace(/\s+([])/g, "$1 "),
  );
}

function readBlocks(html: string): Block[] {
  const blocks: Block[] = [];
  const re = /<(p|h[1-6])>([\s\S]*?)(?=<(?:p|h[1-6])>|<note |<\/note>|$)/g;
  for (const m of html.matchAll(re)) {
    const inner = m[2].replace(/<\/(p|h[1-6]|div)>/g, "");
    const { text, refs, bold } = readInline(inner);
    if (!stripMarks(text).trim() && refs.length === 0) continue;
    blocks.push({ tag: m[1], text, refs, bold });
  }
  return blocks;
}

/** Parses cleaned (or raw) e-qanun HTML into body blocks and endnotes. */
export function parseEqanun(html: string): EqanunDoc {
  const clean = html.startsWith("<!-- e-qanun act -->") ? html : cleanEqanunHtml(html);
  const firstNote = clean.indexOf("<note ");
  const bodyHtml = firstNote >= 0 ? clean.slice(0, firstNote) : clean;
  const body = readBlocks(bodyHtml);
  const endnotes: Endnote[] = [];
  if (firstNote >= 0) {
    for (const m of clean.slice(firstNote).matchAll(/<note n="(\d+)">([\s\S]*?)(?=<note |$)/g)) {
      const blocks = readBlocks(m[2]);
      const first = blocks[0];
      // The endnote's own label ("[12]", "KM1") opens its first paragraph.
      const labelMatch = first ? /^(\[\d+\]|[A-ZƏÜÖ]{1,3}\d+)\s*/.exec(stripMarks(first.text)) : null;
      const label = labelMatch ? labelMatch[1] : `[${m[1]}]`;
      if (first && labelMatch) first.text = first.text.replace(labelMatch[0].trim(), "").trim();
      // Old wordings quoted in an endnote are printed struck through: keep them.
      endnotes.push({ n: Number(m[1]), label, blocks, text: blocks.map((b) => tidy(stripMarks(b.text))).join("\n") });
    }
  }
  return { body, endnotes };
}
