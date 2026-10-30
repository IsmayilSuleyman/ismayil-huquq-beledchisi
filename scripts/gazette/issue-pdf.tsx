import path from "node:path";
import { openSync, type Font as FontFile } from "fontkit";
import React from "react";
import { Document, Font, Link, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import {
  SECTION_KEYS,
  SECTION_TITLE,
  type GazetteDraft,
  type GazetteEntry,
  type SectionKey,
  type Stage,
} from "@/scripts/gazette/draft";
import { formatDate, formatPeriod } from "@/lib/gazette-format";

/**
 * Lays out an automated issue exactly like the published issues 3–12 (made
 * in Word): the navy "omni" / "law gazette" header band on every page, one
 * heading per section, and a numbered list of acts, each with its type
 * label and date, one bold-italic sentence ending with the act's number,
 * and a gold "Mənbə:" line with the source link.
 *
 * Word's fonts are replaced by open ones drawn to the same proportions:
 * Arimo for Arial and Microsoft Sans Serif, Source Serif 4 for Cambria
 * (Cambria's open twin, Caladea, has no ə). Inter Light draws the thin
 * "omni" logotype. All of them carry the Azerbaijani letters.
 */

// Colours measured from issue 12.
const NAVY = "#1f3863"; // headings, labels, item text
const BAND = "#043b74"; // header blocks
const NUMERAL = "#8496b0";
const GOLD = "#bf8f00"; // "Mənbə:"
const LINK = "#0563c1";
const GREY = "#595959"; // dates, notes
const RULE = "#d9d9d9";

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const LEFT = 60;
const RIGHT = 37;
const NUMERAL_WIDTH = 42;
const BODY_GAP = 3;
/** Width of the text column: the page less its margins. */
const CONTENT_WIDTH = A4_WIDTH - LEFT - RIGHT;
/** Width of an item's sentence, beside its numeral. */
const ITEM_WIDTH = CONTENT_WIDTH - NUMERAL_WIDTH - BODY_GAP;
/** Room for the issue line between its start and the "law gazette" block. */
const ISSUE_LINE_LEFT = 376;
const ISSUE_LINE_ROOM = A4_WIDTH - 63 - ISSUE_LINE_LEFT - 6;
const ROOT = process.cwd();
const FONT_DIR = path.join(ROOT, "scripts", "gazette", "fonts");

// ── Measuring ───────────────────────────────────────────────────────────────
//
// react-pdf lets a line run up to a third of its spaces wider than its box
// and then pulls it back in; such a line is drawn out of order, and PDF
// readers then copy and search it as jumbled or run-together words. So the
// sentences are broken into lines here, with the same font files and a
// small margin, and handed over with hard line breaks: no line ever needs
// pulling in.

const fonts = new Map<string, FontFile>();

function textWidth(file: string, text: string, size: number): number {
  let font = fonts.get(file);
  if (!font) {
    font = openSync(path.join(FONT_DIR, file));
    fonts.set(file, font);
  }
  return (font.layout(text).advanceWidth * size) / font.unitsPerEm;
}

/** The text with a line break wherever the next word would pass `width` (less 1.5pt to spare). */
function wrap(text: string, file: string, size: number, width: number): string {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && textWidth(file, candidate, size) > width - 1.5) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.join("\n");
}

let fontsRegistered = false;
function registerFonts() {
  if (fontsRegistered) return;
  const dir = FONT_DIR;
  Font.register({
    family: "Arimo",
    fonts: [{ src: path.join(dir, "Arimo-Regular.ttf") }, { src: path.join(dir, "Arimo-Bold.ttf"), fontWeight: 700 }],
  });
  Font.register({
    family: "Serif",
    fonts: [
      { src: path.join(dir, "SourceSerif4-Regular.ttf") },
      { src: path.join(dir, "SourceSerif4-Italic.ttf"), fontStyle: "italic" },
      { src: path.join(dir, "SourceSerif4-BoldItalic.ttf"), fontStyle: "italic", fontWeight: 700 },
    ],
  });
  Font.register({ family: "Logo", src: path.join(dir, "Inter-Light.ttf") });
  // Azerbaijani words are left whole (the default hyphenator knows English).
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

// As in lesson-pdf: every style that sets a lineHeight also sets its
// fontSize, because react-pdf multiplies a unitless lineHeight by the
// fontSize declared in the same style object.
const styles = StyleSheet.create({
  page: {
    paddingTop: 74,
    paddingBottom: 64,
    paddingLeft: LEFT,
    paddingRight: RIGHT,
    fontFamily: "Arimo",
    fontSize: 10,
    color: NAVY,
    backgroundColor: "#ffffff",
  },

  // Header band, repeated on every page.
  omniBlock: { position: "absolute", top: 10, left: 0, width: 190, height: 49, backgroundColor: BAND },
  omniText: {
    position: "absolute",
    top: 4,
    left: 74,
    fontFamily: "Logo",
    fontSize: 45,
    lineHeight: 1,
    color: "#ffffff",
    letterSpacing: 0.5,
  },
  lawBlock: { position: "absolute", top: 10, left: A4_WIDTH - 63, width: 63, height: 49, backgroundColor: BAND },
  lawText: {
    position: "absolute",
    top: 15,
    left: 7,
    fontFamily: "Arimo",
    fontSize: 12.5,
    lineHeight: 0.98,
    color: "#ffffff",
  },
  kicker: {
    position: "absolute",
    top: 37.5,
    left: 177,
    width: 170,
    textAlign: "right",
    fontFamily: "Arimo",
    fontSize: 9.6,
    lineHeight: 1.06,
    color: NAVY,
  },
  issueLine: {
    position: "absolute",
    top: 38,
    left: ISSUE_LINE_LEFT,
    width: ISSUE_LINE_ROOM,
    fontFamily: "Arimo",
    lineHeight: 1.08,
    color: "#000000",
  },

  heading: { fontFamily: "Arimo", fontWeight: 700, fontSize: 14.5, lineHeight: 1.2, color: NAVY, marginTop: 9, marginBottom: 7 },
  note: { fontFamily: "Serif", fontStyle: "italic", fontSize: 8, lineHeight: 1.35, color: GREY, marginBottom: 4 },
  empty: { fontFamily: "Serif", fontStyle: "italic", fontSize: 8, lineHeight: 1.35, color: GREY, marginBottom: 6 },

  item: {
    flexDirection: "row",
    width: CONTENT_WIDTH,
    paddingTop: 2,
    paddingBottom: 3.5,
    borderBottomWidth: 0.6,
    borderBottomColor: RULE,
    marginBottom: 2.5,
  },
  numeral: { width: NUMERAL_WIDTH, paddingTop: 4.5, fontFamily: "Serif", fontSize: 21, lineHeight: 1, color: NUMERAL, textAlign: "right" },
  body: { width: ITEM_WIDTH, marginLeft: BODY_GAP },
  labelRow: { flexDirection: "row", alignItems: "center", marginBottom: 1.5 },
  label: {
    backgroundColor: NAVY,
    color: "#ffffff",
    fontFamily: "Arimo",
    fontWeight: 700,
    fontSize: 7.4,
    lineHeight: 1.15,
    paddingHorizontal: 2.5,
    paddingTop: 0.6,
  },
  date: { fontFamily: "Arimo", fontSize: 7.8, lineHeight: 1.15, color: GREY, marginLeft: 7 },
  text: { fontFamily: "Serif", fontStyle: "italic", fontWeight: 700, fontSize: 10, lineHeight: 1.06, color: NAVY },
  source: { fontFamily: "Serif", fontStyle: "italic", fontSize: 8.6, lineHeight: 1.25, color: GOLD, marginTop: 1 },
  sourceLink: { color: LINK, textDecoration: "underline" },

  closing: { marginTop: 14, fontFamily: "Arimo", fontSize: 6.8, lineHeight: 1.4, color: GREY },

  // Anchored from the top: a `bottom`-anchored fixed element lands on the
  // wrong pages in react-pdf 4 once text sets a lineHeight.
  pageBox: {
    position: "absolute",
    top: A4_HEIGHT - 54,
    left: A4_WIDTH - 46,
    width: 12,
    height: 10,
    backgroundColor: NAVY,
  },
  pageNumber: {
    position: "absolute",
    top: A4_HEIGHT - 52.6,
    left: A4_WIDTH - 46,
    width: 12,
    textAlign: "center",
    fontFamily: "Arimo",
    fontWeight: 700,
    fontSize: 6.5,
    lineHeight: 1.2,
    color: "#ffffff",
  },
});

/** Upper case with Azerbaijani rules (i → İ). */
function upper(text: string): string {
  return text.toLocaleUpperCase("az");
}

/** "10 Sentyabr 2026": the old issues capitalise the month in labels. */
function labelDate(iso: string): string {
  return formatDate(iso).replace(/ (\p{Ll})/u, (_, c: string) => ` ${c.toLocaleUpperCase("az")}`);
}

const STAGE_WORD: Record<Stage, string> = { I: "birinci", II: "ikinci", III: "üçüncü" };

function label(section: SectionKey, entry: GazetteEntry): string {
  switch (section) {
    case "decrees":
      return "PREZİDENT FƏRMANI";
    case "decisions":
      return "NAZİRLƏR KABİNETİNİN QƏRARI";
    case "bills":
      return "QANUN LAYİHƏSİ";
    case "court":
      return entry.ruling === "qərardad" ? "KONSTİTUSİYA MƏHKƏMƏSİNİN QƏRARDADI" : "KONSTİTUSİYA MƏHKƏMƏSİNİN QƏRARI";
  }
}

/**
 * "(Fərman № 779)", "(Qərar № 264)": how the old issues end each act's
 * sentence. No-break spaces keep the tag on one line.
 */
function numberTag(section: SectionKey, entry: GazetteEntry): string {
  if (!entry.number) return "";
  const nb = "\u00a0";
  if (section === "decrees") return ` (Fərman${nb}№${nb}${entry.number})`;
  if (section === "decisions") return ` (Qərar${nb}№${nb}${entry.number})`;
  return ` (№${nb}${entry.number})`;
}

/** 9.6pt as in the old issues, smaller when a period spanning two months would run under the block. */
function issueLineSize(period: string): number {
  const width = textWidth("Arimo-Regular.ttf", period, 9.6);
  return width <= ISSUE_LINE_ROOM ? 9.6 : Math.max(7.5, (9.6 * ISSUE_LINE_ROOM) / width);
}

function Header({ issueNumber, period }: { issueNumber: number; period: string }) {
  return (
    <>
      <View style={styles.omniBlock} fixed>
        <Text style={styles.omniText}>omni</Text>
      </View>
      <Text style={styles.kicker} fixed>
        {"BU HƏFTƏNİN İCMALI\nAZƏRBAYCAN QANUNVERİCİLİYİ"}
      </Text>
      <Text style={[styles.issueLine, { fontSize: issueLineSize(upper(period)) }]} fixed>
        {`BURAXILIŞ №. ${issueNumber}  ·\n${upper(period)}`}
      </Text>
      <View style={styles.lawBlock} fixed>
        <Text style={styles.lawText}>{"law\ngazette"}</Text>
      </View>
    </>
  );
}

function Item({ section, entry, n }: { section: SectionKey; entry: GazetteEntry; n: number }) {
  const stage = section === "bills" && entry.stage ? `  ·  ${STAGE_WORD[entry.stage]} oxunuşda` : "";
  return (
    <View style={styles.item} wrap={false}>
      <Text style={styles.numeral}>{String(n).padStart(2, "0")}</Text>
      <View style={styles.body}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label(section, entry)}</Text>
          <Text style={styles.date}>{`${labelDate(entry.date)}${stage}`}</Text>
        </View>
        <Text style={styles.text}>
          {wrap(`${entry.text.replace(/\.$/, "")}.${numberTag(section, entry)}`, "SourceSerif4-BoldItalic.ttf", 10, ITEM_WIDTH)}
        </Text>
        <Text style={styles.source}>
          {"Mənbə: "}
          <Link src={entry.url} style={styles.sourceLink}>
            {entry.url}
          </Link>
        </Text>
      </View>
    </View>
  );
}

function Section({ section, draft, first }: { section: SectionKey; draft: GazetteDraft; first: number }) {
  const { note, source, entries } = draft.sections[section];
  const [lead, ...rest] = entries;
  return (
    <View>
      {/* The heading travels with its note and first item, so it is never
          left alone at the foot of a page. */}
      <View wrap={false}>
        <Text style={styles.heading}>{SECTION_TITLE[section]}</Text>
        {note ? <Text style={styles.note}>{wrap(note, "SourceSerif4-Italic.ttf", 8, CONTENT_WIDTH)}</Text> : null}
        {/* As in the old issues: an empty section says so before its source. */}
        {lead ? null : <Text style={styles.empty}>(bu həftəlik heçnə yoxdur)</Text>}
        {source ? (
          <Text style={[styles.source, { marginBottom: 6 }]}>
            {"Mənbə: "}
            <Link src={source} style={styles.sourceLink}>
              {source}
            </Link>
          </Text>
        ) : null}
        {lead ? <Item section={section} entry={lead} n={first} /> : null}
      </View>
      {rest.map((entry, i) => (
        <Item key={i} section={section} entry={entry} n={first + 1 + i} />
      ))}
    </View>
  );
}

/** Days from one ISO date to another. */
function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);
}

/** One small line after the last section: who prepared the issue, and when, if late. */
function Closing({ draft, preparedOn }: { draft: GazetteDraft; preparedOn: string }) {
  const late = daysBetween(draft.published_at, preparedOn) > 2;
  const who = draft.reviewed
    ? "Bu buraxılış rəsmi mənbələr əsasında süni intellekt tərəfindən hazırlanıb və dərc edilməzdən əvvəl redaksiya tərəfindən yoxlanılıb."
    : "Bu buraxılış rəsmi mənbələr əsasında süni intellekt tərəfindən avtomatik hazırlanıb və dərc edilməzdən əvvəl redaktə olunmayıb.";
  return (
    <Text style={styles.closing} wrap={false}>
      {wrap(`${who}${late ? ` Gecikmə ilə, ${formatDate(preparedOn)} tarixində hazırlanıb.` : ""}`, "Arimo-Regular.ttf", 6.8, CONTENT_WIDTH)}
    </Text>
  );
}

export function IssueDocument({
  draft,
  issueNumber,
  preparedOn,
}: {
  draft: GazetteDraft;
  issueNumber: number;
  /** Date the issue is rendered, YYYY-MM-DD. */
  preparedOn: string;
}) {
  const period = formatPeriod(draft.period.from, draft.period.to);
  // Items are numbered 01, 02, … through the whole issue, as in the old issues.
  const firsts: Record<SectionKey, number> = { decrees: 1, decisions: 1, bills: 1, court: 1 };
  let n = 1;
  for (const key of SECTION_KEYS) {
    firsts[key] = n;
    n += draft.sections[key].entries.length;
  }
  return (
    <Document
      title={`Bu həftənin icmalı — Buraxılış № ${issueNumber} (${period})`}
      author="Omni Law Gazette"
      subject="Azərbaycan qanunvericiliyi"
      language="az"
      creator="Omni Law Gazette"
      producer="Omni Law Gazette"
    >
      <Page size="A4" style={styles.page}>
        <Header issueNumber={issueNumber} period={period} />
        {SECTION_KEYS.map((key) => (
          <Section key={key} section={key} draft={draft} first={firsts[key]} />
        ))}
        <Closing draft={draft} preparedOn={preparedOn} />
        <View style={styles.pageBox} fixed />
        <Text style={styles.pageNumber} fixed render={({ pageNumber }) => `${pageNumber}`} />
      </Page>
    </Document>
  );
}

/** The finished issue as PDF bytes. */
export async function renderIssuePdf(
  draft: GazetteDraft,
  issueNumber: number,
  preparedOn = bakuToday()
): Promise<Buffer> {
  registerFonts();
  return renderToBuffer(<IssueDocument draft={draft} issueNumber={issueNumber} preparedOn={preparedOn} />);
}

/** Today's date in Baku (UTC+4, no daylight saving). */
function bakuToday(): string {
  return new Date(Date.now() + 4 * 3_600_000).toISOString().slice(0, 10);
}
