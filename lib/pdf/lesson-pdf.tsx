import { promises as fs } from "node:fs";
import path from "node:path";
import React, { Fragment, type ReactNode } from "react";
import {
  Document,
  Font,
  Link,
  Page,
  Path,
  StyleSheet,
  Svg,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { ListItem, PhrasingContent, RootContent, Table } from "mdast";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import type { LessonPage } from "@/lib/content";
import type { Highlight, HighlightColor } from "@/lib/highlights";

/**
 * Renders a lesson as a branded A4 PDF: the wordmark and course in a
 * running header, the lesson title block, the body laid out from the
 * lesson's Markdown, the reader's highlights painted into the text with
 * each note printed under its passage, the full notebook as an appendix,
 * and page numbers in the footer. Built with @react-pdf/renderer so the
 * text stays selectable and the logo stays vector.
 *
 * The Markdown is parsed with remark (GitHub flavour) rather than the MDX
 * pipeline the page uses: lessons are plain Markdown in practice, and an
 * AST is what a PDF layout needs. Raw HTML in a lesson is dropped.
 */

const INK = "#1c1410";
const BODY = "#3a2c24";
const WOOD = "#5c3d2e";
const WOOD_DEEP = "#3e2a1f";
const BRASS = "#a9843f";
const RING = "#d8c7b4";
const MIST = "#f3ebe0";
const MUTED = "#7b6a5c";

/** Swatch colours for bars and dots (as on the site). */
const SWATCH: Record<HighlightColor, string> = {
  yellow: "#fcd34d",
  green: "#86efac",
  blue: "#93c5fd",
  pink: "#f9a8d4",
};

/** Paler tints behind highlighted text, so the words stay easy to read in print. */
const TINT: Record<HighlightColor, string> = {
  yellow: "#fde68a",
  green: "#bbf7d0",
  blue: "#bfdbfe",
  pink: "#fbcfe8",
};

/** A4 height in PDF points. */
const A4_HEIGHT = 841.89;
/** Body text size in points and its unitless leading. */
const BODY_SIZE = 10.5;
const BODY_LEADING = 1.55;

const ROOT = process.cwd();
const FONT_DIR = path.join(ROOT, "lib", "pdf", "fonts");
const IMAGE_DIR = path.join(ROOT, "public", "images");

let fontsRegistered = false;
function registerFonts() {
  if (fontsRegistered) return;
  Font.register({
    family: "Inter",
    fonts: [
      { src: path.join(FONT_DIR, "Inter-Regular.ttf") },
      { src: path.join(FONT_DIR, "Inter-Italic.ttf"), fontStyle: "italic" },
      { src: path.join(FONT_DIR, "Inter-SemiBold.ttf"), fontWeight: 600 },
      { src: path.join(FONT_DIR, "Inter-SemiBoldItalic.ttf"), fontWeight: 600, fontStyle: "italic" },
    ],
  });
  // The default hyphenator knows English; Azerbaijani words are left whole.
  // (Breaking at dashes is not an option either: react-pdf adds its own
  // hyphen at the break, which reads badly after an en dash.)
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

type SvgArt = { viewBox: string; paths: { d: string; fill: string }[] };

/** Pulls the path outlines out of one of the brand SVGs. */
function parseSvg(svg: string): SvgArt {
  const viewBox = /viewBox="([^"]+)"/.exec(svg)?.[1] ?? "0 0 100 100";
  const rootFill = /<svg[^>]*\sfill="([^"]+)"/.exec(svg)?.[1] ?? "#000";
  const paths: SvgArt["paths"] = [];
  for (const m of svg.matchAll(/<path\b([^>]*)\/?>/g)) {
    const attrs = m[1];
    const d = /\sd="([^"]+)"/.exec(attrs)?.[1];
    if (!d) continue;
    const fill = /\sfill="([^"]+)"/.exec(attrs)?.[1] ?? rootFill;
    paths.push({ d, fill });
  }
  return { viewBox, paths };
}

let artPromise: Promise<{ mark: SvgArt; wordmark: SvgArt }> | null = null;
function loadArt() {
  if (!artPromise) {
    artPromise = Promise.all([
      fs.readFile(path.join(IMAGE_DIR, "ihb-mark.svg"), "utf8"),
      fs.readFile(path.join(IMAGE_DIR, "ihb-wordmark-ink.svg"), "utf8"),
    ]).then(([mark, wordmark]) => ({ mark: parseSvg(mark), wordmark: parseSvg(wordmark) }));
  }
  return artPromise;
}

function Art({ art, height }: { art: SvgArt; height: number }) {
  const [, , w, h] = art.viewBox.split(/\s+/).map(Number);
  const width = h > 0 ? (height * w) / h : height;
  return (
    <Svg viewBox={art.viewBox} style={{ width, height }}>
      {art.paths.map((p, i) => (
        <Path key={i} d={p.d} fill={p.fill} />
      ))}
    </Svg>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 68,
    paddingBottom: 62,
    paddingHorizontal: 56,
    fontFamily: "Inter",
    fontSize: BODY_SIZE,
    color: BODY,
  },
  // react-pdf multiplies a unitless lineHeight by the fontSize declared in
  // the SAME style object (18 when there is none), so every style that sets
  // a lineHeight also sets its fontSize.
  header: {
    position: "absolute",
    top: 26,
    left: 56,
    right: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 8,
    borderBottomWidth: 0.75,
    borderBottomColor: RING,
  },
  brand: { flexDirection: "row", alignItems: "center" },
  headerCourse: {
    fontSize: 7.5,
    letterSpacing: 1.2,
    color: MUTED,
    maxWidth: 260,
    textAlign: "right",
  },
  // Anchored from the top on purpose: with `bottom`, react-pdf 4 places a
  // fixed footer against the unsplit content once any text sets a
  // lineHeight, so it lands on the wrong pages.
  footer: {
    position: "absolute",
    top: A4_HEIGHT - 36,
    left: 56,
    right: 56,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    lineHeight: 1.25,
    color: MUTED,
  },
  kicker: { fontSize: 8, letterSpacing: 1.6, color: BRASS, fontWeight: 600 },
  title: { fontSize: 21, lineHeight: 1.22, fontWeight: 600, color: INK, marginTop: 6 },
  summary: { fontSize: 10.5, lineHeight: 1.5, color: MUTED, marginTop: 8 },
  titleRule: { height: 0.75, backgroundColor: RING, marginTop: 16, marginBottom: 14 },
  p: { fontSize: BODY_SIZE, lineHeight: BODY_LEADING, marginBottom: 7 },
  pTight: { fontSize: BODY_SIZE, lineHeight: BODY_LEADING, marginBottom: 2 },
  h: { fontWeight: 600, color: INK, marginTop: 14, marginBottom: 6 },
  quote: {
    borderLeftWidth: 2,
    borderLeftColor: BRASS,
    paddingLeft: 10,
    marginTop: 4,
    marginBottom: 8,
    color: WOOD_DEEP,
  },
  hr: { height: 0.75, backgroundColor: RING, marginVertical: 12 },
  code: {
    backgroundColor: MIST,
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  codeText: { fontSize: 9, lineHeight: 1.45, color: WOOD_DEEP },
  list: { marginBottom: 7 },
  listItem: { flexDirection: "row", marginBottom: 2 },
  bullet: { width: 16, fontSize: BODY_SIZE, lineHeight: BODY_LEADING, color: BRASS },
  listBody: { flex: 1 },
  table: {
    marginTop: 4,
    marginBottom: 10,
    borderWidth: 0.75,
    borderColor: RING,
    borderRadius: 4,
  },
  row: { flexDirection: "row" },
  cell: { paddingVertical: 4, paddingHorizontal: 6, borderLeftWidth: 0.75, borderLeftColor: RING },
  cellText: { fontSize: 9.5, lineHeight: 1.45 },
  // A note printed right under the passage it belongs to.
  noteBox: { marginTop: 1, marginBottom: 9, paddingLeft: 8, borderLeftWidth: 2 },
  noteLabel: { fontSize: 7, letterSpacing: 1.4, color: BRASS, fontWeight: 600, marginBottom: 1 },
  noteBody: { fontSize: 9.5, lineHeight: 1.5, color: INK },
  appendix: { marginTop: 24, paddingTop: 14, borderTopWidth: 0.75, borderTopColor: RING },
  appendixTitle: { fontSize: 15, fontWeight: 600, color: INK, marginTop: 4, marginBottom: 6, lineHeight: 1.3 },
  noteItem: { flexDirection: "row", marginTop: 8 },
  noteBar: { width: 3, borderRadius: 2, marginRight: 9 },
  noteQuote: { fontSize: 9.5, lineHeight: 1.5, color: MUTED, fontStyle: "italic" },
  noteText: { marginTop: 3, fontSize: BODY_SIZE, lineHeight: BODY_LEADING, color: INK },
});

const HEADING_SIZE: Record<number, number> = { 1: 18, 2: 15, 3: 12.5, 4: 11, 5: 10.5, 6: 10.5 };

// ---------------------------------------------------------------------------
// Placing highlights in the Markdown tree
// ---------------------------------------------------------------------------

/**
 * A highlight is anchored to the rendered page's plain text. The PDF lays
 * out the Markdown tree instead, so each highlight is looked up again in
 * the plain text of the tree's text blocks (paragraphs, headings, table
 * cells) in document order, ignoring differences in whitespace. A passage
 * that runs over several blocks is matched line by line. Whatever cannot
 * be placed is still listed in the appendix.
 */

export type Mark = { start: number; end: number; color: HighlightColor };
export type BlockPlan = { marks: Mark[]; notes: Highlight[] };
export type HighlightPlan = { blocks: Map<number, BlockPlan>; placed: Set<string> };

/** The text a run of inline nodes contributes, in the order inlineMarked() emits it. */
export function plainText(nodes: PhrasingContent[]): string {
  let out = "";
  for (const n of nodes) {
    switch (n.type) {
      case "text":
      case "inlineCode":
        out += n.value;
        break;
      case "break":
        out += "\n";
        break;
      case "image":
        out += n.alt ?? "";
        break;
      default:
        if ("children" in n) out += plainText(n.children as PhrasingContent[]);
    }
  }
  return out;
}

/** Plain text of every text block, in the order the renderer numbers them. */
export function collectTextBlocks(nodes: RootContent[], out: string[] = []): string[] {
  for (const node of nodes) {
    switch (node.type) {
      case "paragraph":
      case "heading":
        out.push(plainText(node.children));
        break;
      case "list":
        for (const item of node.children) collectTextBlocks(item.children, out);
        break;
      case "blockquote":
        collectTextBlocks(node.children, out);
        break;
      case "table":
        for (const row of node.children) for (const cell of row.children) out.push(plainText(cell.children));
        break;
      case "code":
      case "thematicBreak":
      case "html":
      case "definition":
      case "footnoteDefinition":
      case "yaml":
        break;
      default:
        if ("children" in node) collectTextBlocks(node.children as RootContent[], out);
    }
  }
  return out;
}

/**
 * Finds `needle` in `hay` treating any run of whitespace as one space.
 * Returns raw [start, end) offsets into `hay`, or null.
 */
export function findLoose(hay: string, needle: string): [number, number] | null {
  const wanted = needle.replace(/\s+/g, " ").trim();
  if (!wanted) return null;
  let norm = "";
  const raw: number[] = [];
  let inSpace = false;
  for (let i = 0; i < hay.length; i += 1) {
    const ch = hay[i];
    if (/\s/.test(ch)) {
      if (inSpace) continue;
      inSpace = true;
      norm += " ";
    } else {
      inSpace = false;
      norm += ch;
    }
    raw.push(i);
  }
  const at = norm.indexOf(wanted);
  if (at < 0) return null;
  return [raw[at], raw[at + wanted.length - 1] + 1];
}

/** Decides which block shows each highlight's marks and note. */
export function planHighlights(texts: string[], highlights: Highlight[]): HighlightPlan {
  const blocks = new Map<number, BlockPlan>();
  const placed = new Set<string>();
  const plan = (b: number): BlockPlan => {
    let p = blocks.get(b);
    if (!p) {
      p = { marks: [], notes: [] };
      blocks.set(b, p);
    }
    return p;
  };

  for (const h of highlights) {
    let first: number | null = null;

    // The whole passage inside one block.
    for (let b = 0; b < texts.length && first === null; b += 1) {
      const hit = findLoose(texts[b], h.exact);
      if (hit) {
        plan(b).marks.push({ start: hit[0], end: hit[1], color: h.color });
        first = b;
      }
    }

    // A selection over several paragraphs: match it line by line, moving
    // forward through the blocks.
    if (first === null) {
      const pieces = h.exact
        .split(/\n+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      if (pieces.length > 1) {
        let b = 0;
        for (const piece of pieces) {
          for (let k = b; k < texts.length; k += 1) {
            const hit = findLoose(texts[k], piece);
            if (!hit) continue;
            plan(k).marks.push({ start: hit[0], end: hit[1], color: h.color });
            if (first === null) first = k;
            b = k;
            break;
          }
        }
      }
    }

    if (first !== null) {
      placed.add(h.id);
      if (h.note.trim()) plan(first).notes.push(h);
    }
  }
  return { blocks, placed };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

type Cursor = { pos: number };
type Ctx = { plan: HighlightPlan; index: number };
const NO_PLAN: BlockPlan = { marks: [], notes: [] };

/** The plan for the next text block, advancing the block counter. */
function nextBlock(ctx: Ctx): BlockPlan {
  const p = ctx.plan.blocks.get(ctx.index) ?? NO_PLAN;
  ctx.index += 1;
  return p;
}

/** Splits a text run at mark boundaries and tints the marked parts. */
function segments(value: string, marks: Mark[], cur: Cursor): ReactNode[] {
  const start = cur.pos;
  const end = start + value.length;
  cur.pos = end;
  if (marks.length === 0 || value.length === 0) return [value];
  const cuts = new Set<number>([start, end]);
  for (const m of marks) {
    if (m.start > start && m.start < end) cuts.add(m.start);
    if (m.end > start && m.end < end) cuts.add(m.end);
  }
  const points = [...cuts].sort((a, b) => a - b);
  const out: ReactNode[] = [];
  for (let k = 0; k < points.length - 1; k += 1) {
    const a = points[k];
    const b = points[k + 1];
    const text = value.slice(a - start, b - start);
    const mark = marks.find((m) => m.start <= a && m.end >= b);
    out.push(
      mark ? (
        <Text key={k} style={{ backgroundColor: TINT[mark.color] }}>
          {text}
        </Text>
      ) : (
        text
      ),
    );
  }
  return out;
}

function inlineMarked(nodes: PhrasingContent[], marks: Mark[], cur: Cursor): ReactNode[] {
  return nodes.map((node, i) => {
    switch (node.type) {
      case "text":
        return <Fragment key={i}>{segments(node.value, marks, cur)}</Fragment>;
      case "strong":
        return (
          <Text key={i} style={{ fontWeight: 600 }}>
            {inlineMarked(node.children, marks, cur)}
          </Text>
        );
      case "emphasis":
        return (
          <Text key={i} style={{ fontStyle: "italic" }}>
            {inlineMarked(node.children, marks, cur)}
          </Text>
        );
      case "delete":
        return (
          <Text key={i} style={{ textDecoration: "line-through" }}>
            {inlineMarked(node.children, marks, cur)}
          </Text>
        );
      case "inlineCode":
        return (
          <Text key={i} style={{ color: WOOD_DEEP }}>
            {segments(node.value, marks, cur)}
          </Text>
        );
      case "link":
        return (
          <Link key={i} src={node.url} style={{ color: BRASS, textDecoration: "underline" }}>
            {inlineMarked(node.children, marks, cur)}
          </Link>
        );
      case "break":
        cur.pos += 1;
        return "\n";
      case "image":
        cur.pos += (node.alt ?? "").length;
        return node.alt ?? "";
      default:
        return "children" in node
          ? inlineMarked(node.children as PhrasingContent[], marks, cur)
          : "";
    }
  });
}

function NoteBox({ h }: { h: Highlight }) {
  return (
    <View style={[styles.noteBox, { borderLeftColor: SWATCH[h.color] }]} wrap={h.note.length > 600}>
      <Text style={styles.noteLabel}>QEYD</Text>
      <Text style={styles.noteBody}>{h.note.trim()}</Text>
    </View>
  );
}

function notesAfter(plan: BlockPlan): ReactNode {
  return plan.notes.map((h) => <NoteBox key={h.id} h={h} />);
}

function blocks(nodes: RootContent[], ctx: Ctx, tight = false): ReactNode[] {
  return nodes.map((node, i) => {
    switch (node.type) {
      case "paragraph": {
        const plan = nextBlock(ctx);
        return (
          <Fragment key={i}>
            <Text style={tight ? styles.pTight : styles.p}>
              {inlineMarked(node.children, plan.marks, { pos: 0 })}
            </Text>
            {notesAfter(plan)}
          </Fragment>
        );
      }
      case "heading": {
        const plan = nextBlock(ctx);
        return (
          <Fragment key={i}>
            <Text
              minPresenceAhead={60}
              style={[
                styles.h,
                {
                  fontSize: HEADING_SIZE[node.depth] ?? BODY_SIZE,
                  lineHeight: 1.3,
                },
              ]}
            >
              {inlineMarked(node.children, plan.marks, { pos: 0 })}
            </Text>
            {notesAfter(plan)}
          </Fragment>
        );
      }
      case "list":
        return (
          <View key={i} style={tight ? { marginTop: 2, marginBottom: 2 } : styles.list}>
            {node.children.map((item: ListItem, j: number) => {
              const marker = node.ordered
                ? `${(node.start ?? 1) + j}.`
                : item.checked === true
                  ? "[x]"
                  : item.checked === false
                    ? "[ ]"
                    : "•";
              return (
                <View key={j} style={styles.listItem}>
                  <Text style={styles.bullet}>{marker}</Text>
                  <View style={styles.listBody}>{blocks(item.children, ctx, !node.spread)}</View>
                </View>
              );
            })}
          </View>
        );
      case "blockquote":
        return (
          <View key={i} style={styles.quote}>
            {blocks(node.children, ctx)}
          </View>
        );
      case "thematicBreak":
        return <View key={i} style={styles.hr} />;
      case "code":
        return (
          <View key={i} style={styles.code}>
            <Text style={styles.codeText}>{node.value}</Text>
          </View>
        );
      case "table":
        // A plain call, not a component: the block counter must advance while
        // this tree is being built, before the paragraphs after the table.
        return tableBlock(node, ctx, i);
      case "html":
      case "definition":
      case "footnoteDefinition":
      case "yaml":
        return null;
      default:
        return "children" in node ? (
          <View key={i}>{blocks(node.children as RootContent[], ctx)}</View>
        ) : null;
    }
  });
}

/**
 * Columns share the width in proportion to how much text they carry, but
 * never narrower than their longest unbreakable token (words are not
 * hyphenated, so "142–146-1" or "özünüidarəetmə" must fit on one line).
 */
function tableBlock(table: Table, ctx: Ctx, key: number): ReactNode {
  const columns = Math.max(...table.children.map((r) => r.children.length), 1);
  const weights = Array.from({ length: columns }, (_, c) => {
    const texts = table.children.map((r) => plainText(r.children[c]?.children ?? []));
    const avg = texts.reduce((a, t) => a + t.length, 0) / Math.max(texts.length, 1);
    const longest = Math.max(0, ...texts.flatMap((t) => t.split(/\s+/).map((w) => w.length)));
    return Math.min(Math.max(avg, longest * 1.25 + 2, 8), 60);
  });
  return (
    <View key={key} style={styles.table}>
      {table.children.map((row, r) => (
        <View
          key={r}
          wrap={false}
          style={[
            styles.row,
            r > 0 ? { borderTopWidth: 0.75, borderTopColor: RING } : {},
            r === 0 ? { backgroundColor: MIST } : {},
          ]}
        >
          {row.children.map((cell, c) => {
            // Every cell is a text block, so the counter must advance for each
            // one the planner counted, in the same order.
            const plan = nextBlock(ctx);
            return (
              <View
                key={c}
                style={[styles.cell, { flex: weights[c] ?? 8 }, c === 0 ? { borderLeftWidth: 0 } : {}]}
              >
                <Text
                  style={[
                    styles.cellText,
                    r === 0 ? { fontWeight: 600, color: WOOD } : {},
                    table.align?.[c] === "right"
                      ? { textAlign: "right" }
                      : table.align?.[c] === "center"
                        ? { textAlign: "center" }
                        : {},
                  ]}
                >
                  {inlineMarked(cell.children, plan.marks, { pos: 0 })}
                </Text>
                {notesAfter(plan)}
              </View>
            );
          })}
          {Array.from({ length: columns - row.children.length }, (_, k) => (
            <View key={`pad-${k}`} style={[styles.cell, { flex: weights[row.children.length + k] ?? 8 }]} />
          ))}
        </View>
      ))}
    </View>
  );
}

export type LessonPdfInput = {
  page: LessonPage;
  highlights: Highlight[];
  /** Host name shown in the footer (taken from the request). */
  host: string;
  /** Reader's name for the footer; the handout is theirs. */
  readerName: string | null;
  /** Date of the export; defaults to now. */
  date?: Date;
};

/** The lesson's Markdown body as a GitHub-flavoured Markdown tree. */
export function parseLessonBody(body: string): RootContent[] {
  return remark().use(remarkGfm).parse(body).children;
}

function LessonDocument({
  page,
  highlights,
  host,
  readerName,
  date,
  art,
}: LessonPdfInput & { date: Date; art: { mark: SvgArt; wordmark: SvgArt } }) {
  const { course, lesson } = page;
  const index = course.lessons.findIndex((l) => l.slug === lesson.slug) + 1;
  const kicker = [
    `Dərs ${index} / ${course.lessons.length}`,
    lesson.minutes ? `${lesson.minutes} dəqiqə` : null,
  ]
    .filter(Boolean)
    .join("  ·  ")
    .toLocaleUpperCase("az");
  const when = date.toLocaleDateString("az-AZ", { day: "numeric", month: "long", year: "numeric" });
  const footerLeft = [host, readerName, when].filter(Boolean).join("  ·  ");
  const tree = parseLessonBody(lesson.body);
  const ctx: Ctx = { plan: planHighlights(collectTextBlocks(tree), highlights), index: 0 };
  const notes = highlights.filter((h) => h.note.trim().length > 0).length;

  return (
    <Document
      title={`${lesson.title} · ${course.title}`}
      author="İsmayıl Hüquq Bələdçisi"
      subject={course.title}
      language="az"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header} fixed>
          <View style={styles.brand}>
            <Art art={art.mark} height={15} />
            <View style={{ width: 6 }} />
            <Art art={art.wordmark} height={13} />
          </View>
          <Text style={styles.headerCourse}>{course.title.toLocaleUpperCase("az")}</Text>
        </View>
        {/* Fixed elements go before the flowing body: placed after it, react-pdf
            positions them off the last wrapped node instead of the page. */}
        <View style={styles.footer} fixed>
          <Text>{footerLeft}</Text>
          <Text render={({ pageNumber, totalPages }) => `Səhifə ${pageNumber} / ${totalPages}`} />
        </View>

        <Text style={styles.kicker}>{kicker}</Text>
        <Text style={styles.title}>{lesson.title}</Text>
        {lesson.summary ? <Text style={styles.summary}>{lesson.summary}</Text> : null}
        <View style={styles.titleRule} />

        {blocks(tree, ctx)}

        {highlights.length > 0 ? (
          <View style={styles.appendix} minPresenceAhead={90}>
            <Text style={styles.kicker}>QEYD DƏFTƏRİ</Text>
            <Text style={styles.appendixTitle}>İşarələmələr və qeydlər</Text>
            <Text style={{ fontSize: 9, lineHeight: 1.5, color: MUTED }}>
              {highlights.length} işarələmə · {notes} qeyd
            </Text>
            {highlights.map((h) => (
              <View
                key={h.id}
                style={styles.noteItem}
                wrap={h.exact.length + h.note.length > 600}
              >
                <View style={[styles.noteBar, { backgroundColor: SWATCH[h.color] }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.noteQuote}>“{h.exact.replace(/\s+/g, " ").trim()}”</Text>
                  {h.note.trim() ? <Text style={styles.noteText}>{h.note.trim()}</Text> : null}
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </Page>
    </Document>
  );
}

/** Renders the lesson to PDF bytes. */
export async function renderLessonPdf(input: LessonPdfInput): Promise<Buffer> {
  registerFonts();
  const art = await loadArt();
  const doc = <LessonDocument {...input} date={input.date ?? new Date()} art={art} />;
  return renderToBuffer(doc);
}
