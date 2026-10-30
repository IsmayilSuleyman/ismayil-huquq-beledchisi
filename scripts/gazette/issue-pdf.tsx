import path from "node:path";
import React from "react";
import { Document, Font, Link, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import {
  KIND_LABEL,
  KIND_PLURAL,
  countByKind,
  type EntryKind,
  type GazetteDraft,
  type GazetteEntry,
  type GazetteSection,
} from "@/scripts/gazette/draft";
import { formatDate, formatPeriod } from "@/lib/gazette-format";

/**
 * Lays out an automated gazette issue as an A4 newspaper PDF, in the
 * design of the hand-made issues: masthead, dark week banner, an
 * at-a-glance box with counts and the week's main points, the editor's
 * overview, one section per institution, then sources and the disclaimer.
 * Serif body (Source Serif 4) with sans labels (Inter); both carry the
 * Azerbaijani letters.
 */

const INK = "#1a1a1a";
const BODY = "#2b2b2b";
const MUTED = "#666666";
const FAINT = "#8a8a8a";
const RULE = "#cccccc";
const DOTTED = "#d4d4d4";
const PAPER_TINT = "#f7f5f0";
const NAVY = "#1d4287";

/** Chip colours per act type, after the hand-made issues. */
const TAG: Record<EntryKind, string> = {
  law: "#1a3a1a",
  bill: "#6b6b6b",
  decree: "#2c3e50",
  order: "#4a4a4a",
  decision: "#1d4287",
  court: "#5a2a2a",
  other: "#3a3a3a",
};

const A4_HEIGHT = 841.89;
const SITE = "ismayilhuquqbeledchisi.vercel.app/gazette";
const ROOT = process.cwd();

let fontsRegistered = false;
function registerFonts() {
  if (fontsRegistered) return;
  const serif = path.join(ROOT, "scripts", "gazette", "fonts");
  const sans = path.join(ROOT, "lib", "pdf", "fonts");
  Font.register({
    family: "Serif",
    fonts: [
      { src: path.join(serif, "SourceSerif4-Regular.ttf") },
      { src: path.join(serif, "SourceSerif4-Italic.ttf"), fontStyle: "italic" },
      { src: path.join(serif, "SourceSerif4-Bold.ttf"), fontWeight: 700 },
    ],
  });
  Font.register({
    family: "Inter",
    fonts: [
      { src: path.join(sans, "Inter-Regular.ttf") },
      { src: path.join(sans, "Inter-Italic.ttf"), fontStyle: "italic" },
      { src: path.join(sans, "Inter-SemiBold.ttf"), fontWeight: 600 },
      { src: path.join(sans, "Inter-SemiBoldItalic.ttf"), fontWeight: 600, fontStyle: "italic" },
    ],
  });
  // Azerbaijani words are left whole (the default hyphenator knows English).
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

// As in lesson-pdf: every style that sets a lineHeight also sets its
// fontSize, because react-pdf multiplies a unitless lineHeight by the
// fontSize declared in the same style object.
const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 58,
    paddingHorizontal: 46,
    fontFamily: "Serif",
    fontSize: 10,
    color: BODY,
    backgroundColor: "#ffffff",
  },
  // Anchored from the top: a `bottom`-anchored fixed footer lands on the
  // wrong pages in react-pdf 4 once text sets a lineHeight.
  footer: {
    position: "absolute",
    top: A4_HEIGHT - 34,
    left: 46,
    right: 46,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.75,
    borderTopColor: RULE,
    paddingTop: 6,
    fontFamily: "Inter",
    fontSize: 7,
    lineHeight: 1.2,
    color: FAINT,
    letterSpacing: 0.4,
  },

  masthead: { borderTopWidth: 3.5, borderTopColor: INK, borderBottomWidth: 1.5, borderBottomColor: INK },
  mastTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    fontFamily: "Inter",
    fontSize: 6.5,
    lineHeight: 1.2,
    color: MUTED,
    letterSpacing: 0.8,
  },
  markBlock: {
    backgroundColor: NAVY,
    color: "#ffffff",
    fontFamily: "Inter",
    fontSize: 11,
    lineHeight: 1.05,
    paddingTop: 0.5,
    paddingBottom: 2.5,
    paddingHorizontal: 5,
    letterSpacing: 0.2,
  },
  markCaption: { fontFamily: "Inter", fontSize: 4, lineHeight: 1.2, letterSpacing: 2.6, color: MUTED, marginTop: 2 },
  mastTitleRow: { flexDirection: "row", justifyContent: "center", alignItems: "flex-end", marginTop: 6 },
  mastTitle: { fontFamily: "Serif", fontWeight: 700, fontSize: 38, lineHeight: 1.05, color: INK, letterSpacing: -0.5 },
  mastTitleSoft: { fontFamily: "Serif", fontStyle: "italic", fontWeight: 400 },
  mastSub: {
    textAlign: "center",
    fontFamily: "Inter",
    fontSize: 7.5,
    lineHeight: 1.3,
    letterSpacing: 1.6,
    color: MUTED,
    marginTop: 4,
  },
  mastRule: { height: 0.75, backgroundColor: INK, marginTop: 9 },
  mastMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    fontFamily: "Inter",
    fontSize: 6.8,
    lineHeight: 1.2,
    color: MUTED,
    letterSpacing: 0.6,
  },
  banner: {
    backgroundColor: INK,
    color: "#ffffff",
    textAlign: "center",
    paddingVertical: 5,
    fontFamily: "Inter",
    fontSize: 7.2,
    lineHeight: 1.2,
    letterSpacing: 1.8,
    marginBottom: 14,
  },

  glance: {
    borderWidth: 0.75,
    borderColor: RULE,
    borderLeftWidth: 3.5,
    borderLeftColor: INK,
    backgroundColor: PAPER_TINT,
    paddingVertical: 10,
    paddingHorizontal: 13,
    marginBottom: 14,
  },
  boxLabel: {
    fontFamily: "Inter",
    fontWeight: 600,
    fontSize: 6.8,
    lineHeight: 1.2,
    letterSpacing: 1.8,
    color: MUTED,
    borderBottomWidth: 0.75,
    borderBottomColor: "#e0e0e0",
    paddingBottom: 4,
    marginBottom: 8,
  },
  counts: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", marginBottom: 4 },
  count: { alignItems: "center", paddingHorizontal: 4, marginBottom: 6 },
  countNum: { fontFamily: "Serif", fontWeight: 700, fontSize: 24, lineHeight: 1, color: INK },
  countLabel: { fontFamily: "Inter", fontSize: 7, lineHeight: 1.3, color: MUTED, marginTop: 3, textAlign: "center" },
  points: { marginTop: 8, borderTopWidth: 0.75, borderTopColor: "#e0e0e0", paddingTop: 7 },
  point: { flexDirection: "row", marginBottom: 3 },
  pointMark: { width: 10, fontFamily: "Serif", fontWeight: 700, fontSize: 9.5, lineHeight: 1.45, color: INK },
  pointText: { flex: 1, fontFamily: "Serif", fontSize: 9.5, lineHeight: 1.45, color: BODY },

  overview: { marginBottom: 6 },
  overviewP: { fontFamily: "Serif", fontSize: 10.2, lineHeight: 1.55, color: BODY, marginBottom: 6 },
  headline: { fontFamily: "Serif", fontWeight: 700, fontSize: 17, lineHeight: 1.2, color: INK, marginBottom: 7 },

  sectionHead: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    borderTopWidth: 1.5,
    borderTopColor: INK,
    borderBottomWidth: 0.75,
    borderBottomColor: RULE,
    paddingTop: 5,
    paddingBottom: 4,
    marginTop: 14,
    marginBottom: 9,
  },
  sectionTitle: { fontFamily: "Serif", fontWeight: 700, fontSize: 14.5, lineHeight: 1.15, color: INK },
  sectionSub: {
    fontFamily: "Inter",
    fontStyle: "italic",
    fontSize: 7.5,
    lineHeight: 1.3,
    color: FAINT,
    maxWidth: 230,
    textAlign: "right",
  },
  intro: { fontFamily: "Inter", fontSize: 8.3, lineHeight: 1.5, color: MUTED, marginBottom: 9 },
  notice: {
    borderWidth: 0.75,
    borderColor: RULE,
    borderStyle: "dashed",
    backgroundColor: PAPER_TINT,
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontFamily: "Serif",
    fontStyle: "italic",
    fontSize: 9.2,
    lineHeight: 1.5,
    color: MUTED,
  },

  entry: { paddingBottom: 8, marginBottom: 8, borderBottomWidth: 0.6, borderBottomColor: DOTTED, borderBottomStyle: "dotted" },
  entryLast: { paddingBottom: 2, marginBottom: 2 },
  entryMeta: { flexDirection: "row", alignItems: "center", marginBottom: 3 },
  tag: {
    fontFamily: "Inter",
    fontWeight: 600,
    fontSize: 6,
    lineHeight: 1.2,
    letterSpacing: 0.9,
    color: "#ffffff",
    paddingVertical: 1.5,
    paddingHorizontal: 4,
  },
  metaText: { fontFamily: "Inter", fontSize: 7, lineHeight: 1.2, color: FAINT, marginLeft: 6 },
  entryTitle: { fontFamily: "Serif", fontWeight: 700, fontSize: 10.2, lineHeight: 1.35, color: INK, marginBottom: 2 },
  entryBody: { fontFamily: "Serif", fontSize: 9.4, lineHeight: 1.5, color: BODY },
  entryLink: { fontFamily: "Inter", fontSize: 6.8, lineHeight: 1.3, color: NAVY, marginTop: 2, textDecoration: "none" },

  closing: { marginTop: 16, borderTopWidth: 1.5, borderTopColor: INK, paddingTop: 8 },
  sourceLine: { fontFamily: "Inter", fontSize: 7, lineHeight: 1.45, color: MUTED },
  sourceLink: { color: NAVY, textDecoration: "none" },
  disclaimer: {
    marginTop: 10,
    fontFamily: "Inter",
    fontStyle: "italic",
    fontSize: 7,
    lineHeight: 1.5,
    color: FAINT,
  },
});

/** Upper case with Azerbaijani rules (i → İ), for labels and meta lines. */
function upper(text: string): string {
  return text.toLocaleUpperCase("az");
}

/** ISO week number of a date, for the banner. */
function isoWeek(iso: string): number {
  const d = new Date(`${iso}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3); // Thursday of this week
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDay + 3);
  return 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
}

function weekLabel(from: string, to: string): string {
  const a = isoWeek(from);
  const b = isoWeek(to);
  const year = to.slice(0, 4);
  return a === b ? `${year} · HƏFTƏ ${b}` : `${year} · HƏFTƏLƏR ${a}–${b}`;
}

/** Host and path without the scheme, for printing a link compactly. */
function shortUrl(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
}

function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
}

/** The Omni Law Firm mark as on the site: navy block, light wordmark, spaced caption. */
function OmniMark() {
  return (
    <View style={{ alignItems: "center" }}>
      <Text style={styles.markBlock}>omni</Text>
      <Text style={styles.markCaption}>LAW FIRM</Text>
    </View>
  );
}

function Masthead({ draft, issueNumber }: { draft: GazetteDraft; issueNumber: number }) {
  return (
    <View>
      <View style={styles.masthead}>
        <View style={styles.mastTop}>
          <OmniMark />
          <Text>{upper("Həftəlik qanunvericilik icmalı")}</Text>
          <Text>{SITE}</Text>
        </View>
        <View style={styles.mastTitleRow}>
          <Text style={styles.mastTitle}>
            OMNI <Text style={styles.mastTitleSoft}>Law</Text> GAZETTE
          </Text>
        </View>
        <Text style={styles.mastSub}>{upper("Hüquq mütəxəssisləri üçün qanunvericilik bələdçisi")}</Text>
        <View style={styles.mastRule} />
        <View style={styles.mastMeta}>
          <Text>{upper(`Buraxılış № ${issueNumber}`)}</Text>
          <Text>{upper(`Hesabat dövrü: ${formatPeriod(draft.period.from, draft.period.to)}`)}</Text>
          <Text>{upper(`Nəşr tarixi: ${formatDate(draft.published_at)}`)}</Text>
        </View>
      </View>
      <Text style={styles.banner}>
        {`${weekLabel(draft.period.from, draft.period.to)}  ·  AZƏRBAYCAN RESPUBLİKASI  ·  QANUNVERİCİLİK MONİTORİNQİ`}
      </Text>
    </View>
  );
}

function AtAGlance({ draft }: { draft: GazetteDraft }) {
  const counts = countByKind(draft);
  const total = counts.reduce((n, c) => n + c.count, 0);
  const tiles = counts.length + (counts.length > 1 ? 1 : 0);
  const tileWidth = `${100 / Math.min(Math.max(tiles, 1), 7)}%`;
  return (
    <View style={styles.glance} wrap={false}>
      <Text style={styles.boxLabel}>{upper("Həftə bir baxışda")}</Text>
      <View style={styles.counts}>
        {counts.length === 0 ? (
          <View style={styles.count}>
            <Text style={styles.countNum}>0</Text>
            <Text style={styles.countLabel}>Yeni sənəd</Text>
          </View>
        ) : (
          // Every kind, so the tiles always add up to the total; seven fit on a row.
          counts.map((c) => (
            <View key={c.kind} style={[styles.count, { width: tileWidth }]}>
              <Text style={styles.countNum}>{c.count}</Text>
              <Text style={styles.countLabel}>{KIND_PLURAL[c.kind]}</Text>
            </View>
          ))
        )}
        {counts.length > 1 ? (
          <View style={[styles.count, { width: tileWidth }]}>
            <Text style={styles.countNum}>{total}</Text>
            <Text style={styles.countLabel}>Cəmi sənəd</Text>
          </View>
        ) : null}
      </View>
      {draft.highlights.length > 0 ? (
        <View style={styles.points}>
          {draft.highlights.map((point, i) => (
            <View key={i} style={styles.point}>
              <Text style={styles.pointMark}>•</Text>
              <Text style={styles.pointText}>{point}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Overview({ headline, text }: { headline: string; text: string }) {
  return (
    <View style={styles.overview}>
      <Text style={styles.boxLabel}>{upper("Redaksiya icmalı")}</Text>
      <Text style={styles.headline}>{headline}</Text>
      {paragraphs(text).map((p, i) => (
        <Text key={i} style={styles.overviewP}>
          {p}
        </Text>
      ))}
    </View>
  );
}

function Entry({ entry, last }: { entry: GazetteEntry; last: boolean }) {
  const meta = [entry.number ? `№ ${entry.number}` : null, formatDate(entry.date)].filter(Boolean).join("  ·  ");
  return (
    <View style={last ? [styles.entry, styles.entryLast, { borderBottomWidth: 0 }] : styles.entry} wrap={false}>
      <View style={styles.entryMeta}>
        <Text style={[styles.tag, { backgroundColor: TAG[entry.kind] }]}>{upper(KIND_LABEL[entry.kind])}</Text>
        <Text style={styles.metaText}>{meta}</Text>
      </View>
      <Text style={styles.entryTitle}>{entry.title}</Text>
      <Text style={styles.entryBody}>{entry.summary}</Text>
      {entry.url ? (
        <Link src={entry.url} style={styles.entryLink}>
          {shortUrl(entry.url)}
        </Link>
      ) : null}
    </View>
  );
}

function Section({ section }: { section: GazetteSection }) {
  const [first, ...rest] = section.entries;
  return (
    <View>
      {/* The heading travels with its intro or notice and the first entry, so
          it is never left alone at the foot of a page. (minPresenceAhead
          cannot do this: react-pdf ignores it on a container's first child.) */}
      <View wrap={false}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>{section.institution}</Text>
          {section.subtitle ? <Text style={styles.sectionSub}>{section.subtitle}</Text> : null}
        </View>
        {section.intro ? <Text style={styles.intro}>{section.intro}</Text> : null}
        {!first && section.notice ? <Text style={styles.notice}>{section.notice}</Text> : null}
        {first ? <Entry entry={first} last={rest.length === 0} /> : null}
      </View>
      {rest.map((entry, i) => (
        <Entry key={i} entry={entry} last={i === rest.length - 1} />
      ))}
      {first && section.notice ? <Text style={[styles.notice, { marginTop: 6 }]}>{section.notice}</Text> : null}
    </View>
  );
}

/** Days from one ISO date to another. */
function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);
}

function Closing({ draft, preparedOn }: { draft: GazetteDraft; preparedOn: string }) {
  // A catch-up issue carries its week's date; say when it was really written.
  const late = daysBetween(draft.published_at, preparedOn) > 2;
  return (
    // Moves to the next page as a whole rather than leave its heading behind.
    <View style={styles.closing} wrap={false}>
      <Text style={styles.boxLabel}>{upper("Mənbələr")}</Text>
      {/* One running paragraph: a long source list would otherwise fill a page. */}
      <Text style={styles.sourceLine}>
        {draft.sources.map((url, i) => (
          <React.Fragment key={url}>
            {i > 0 ? "  ·  " : ""}
            <Link src={url} style={styles.sourceLink}>
              {shortUrl(url)}
            </Link>
          </React.Fragment>
        ))}
      </Text>
      <Text style={styles.disclaimer}>
        {draft.reviewed
          ? "Bu buraxılış rəsmi dövlət mənbələri əsasında süni intellekt tərəfindən hazırlanıb və dərc edilməzdən əvvəl redaksiya tərəfindən yoxlanılıb."
          : "Bu buraxılış rəsmi dövlət mənbələri əsasında süni intellekt tərəfindən avtomatik hazırlanıb və dərc edilməzdən əvvəl redaktə olunmayıb."}{" "}
        İcmal məlumat xarakterlidir və hüquqi məsləhət deyil; aktların rəsmi mətni üçün e-qanun.az və müvafiq
        dövlət orqanlarının saytlarına müraciət edin.
        {late ? ` Bu buraxılış gecikmə ilə, ${formatDate(preparedOn)} tarixində hazırlanıb.` : ""}
      </Text>
    </View>
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
  return (
    <Document
      title={`Omni Law Gazette — Buraxılış № ${issueNumber} (${period})`}
      author="Omni Law Gazette"
      subject={draft.headline}
      keywords={draft.tags.join(", ")}
      language="az"
      creator="Omni Law Gazette"
      producer="Omni Law Gazette"
    >
      <Page size="A4" style={styles.page}>
        <Masthead draft={draft} issueNumber={issueNumber} />
        <AtAGlance draft={draft} />
        <Overview headline={draft.headline} text={draft.overview} />
        {draft.sections.map((section, i) => (
          <Section key={i} section={section} />
        ))}
        <Closing draft={draft} preparedOn={preparedOn} />
        {/* Kept last so react-pdf repeats it on every page. */}
        <View style={styles.footer} fixed>
          {/* The brand stays out of Azerbaijani casing, which would dot its i. */}
          <Text>{`OMNI LAW GAZETTE · ${upper(`Buraxılış № ${issueNumber} · ${period}`)}`}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
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
