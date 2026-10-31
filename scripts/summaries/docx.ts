/**
 * Lays a Constitutional Court summary out as a Word file: the firm's
 * header artwork (the same "omni" band the gazette issues carry), the
 * decision named and linked, an "AI-generated" notice, the topic line in
 * bold italic as in Elgun's emails, and the Court's passages as bullets
 * with his underline, bold and italic kept. No email frame: no "Dear all",
 * no sign-off. Calibri 11, as the drafts were typed in.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  Footer,
  Header,
  ImageRun,
  LevelFormat,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  TabStopType,
  TextRun,
  type IRunOptions,
} from "docx";
import { parseMarks } from "@/lib/gazette/marks";
import { dottedDate, kindLabel } from "@/lib/gazette/summaries";
import { TAG_LABEL } from "@/lib/gazette/summary-tags";
import { ROUTINE_AUTHOR, type SummaryDraft } from "@/scripts/summaries/draft";

const here = dirname(fileURLToPath(import.meta.url));
/** The header band of the gazette issues (scripts/gazette/images), 838×224. */
const HEADER_IMAGE = join(here, "..", "gazette", "images", "header-omni.jpg");

const NAVY = "1D4287";
const INK = "1F2937";
const GREY = "6B7280";
const FONT = "Calibri";
const CM = 567; // twips

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" });

function longDate(iso: string): string {
  return dateFmt.format(new Date(`${iso.slice(0, 10)}T00:00:00`));
}

/** Runs for marked text; `base` sets the colour and size, the marks add emphasis. */
function runs(text: string, base: IRunOptions = {}): TextRun[] {
  return parseMarks(text).map(
    (s) =>
      new TextRun({
        ...base,
        text: s.text,
        bold: s.bold || base.bold,
        italics: s.italic || base.italics,
        underline: s.underline ? { type: "single" } : base.underline,
      }),
  );
}

export type DocxOptions = {
  /** When the file was made; printed in the notice and the footer. */
  generatedAt?: Date;
  /** Where the summary is published, for the footer. */
  site?: string;
};

/** Renders the Word file for a checked draft. */
export async function renderSummaryDocx(draft: SummaryDraft, options: DocxOptions = {}): Promise<Buffer> {
  const generatedAt = options.generatedAt ?? new Date();
  const site = options.site ?? "https://omnilawgazette.vercel.app";
  const madeOn = dateFmt.format(generatedAt);
  const kind = kindLabel(draft.kind);
  const heading = `${kind} of ${longDate(draft.decision_date)}`;
  const link = `${site}/summaries/${draft.decision_id}`;
  const author = draft.author ?? ROUTINE_AUTHOR;
  const generated = !draft.author;
  const credit = generated ? `AI-generated summary · Omni Law Firm · ${madeOn}` : `Summary by ${author} · Omni Law Firm`;
  const tags = draft.tags.map((t) => TAG_LABEL[t]).join(" · ");

  const header = new Header({
    children: [
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: 17 * CM }],
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: NAVY, space: 6 } },
        spacing: { after: 240 },
        children: [
          new ImageRun({
            type: "jpg",
            data: readFileSync(HEADER_IMAGE),
            // 838×224 px, shown 4.5 cm wide.
            transformation: { width: 170, height: 45 },
            altText: { title: "Omni Law Firm", description: "Omni Law Firm", name: "omni" },
          }),
          new TextRun({
            text: "\tConstitutional Court · Decision summaries",
            font: FONT,
            size: 16,
            color: GREY,
            characterSpacing: 30,
            allCaps: true,
          }),
        ],
      }),
    ],
  });

  const footer = new Footer({
    children: [
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: 17 * CM }],
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: "D1D5DB", space: 6 } },
        children: [
          new TextRun({ text: credit, font: FONT, size: 15, color: GREY }),
          new TextRun({ text: "\tPage ", font: FONT, size: 15, color: GREY }),
          new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 15, color: GREY }),
          new TextRun({ text: " of ", font: FONT, size: 15, color: GREY }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 15, color: GREY }),
        ],
      }),
    ],
  });

  const body: Paragraph[] = [
    new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: "Constitutional Court of the Republic of Azerbaijan · Plenum",
          font: FONT,
          size: 17,
          color: NAVY,
          allCaps: true,
          characterSpacing: 40,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 60 },
      children: [new TextRun({ text: heading, font: "Calibri Light", size: 44, color: NAVY })],
    }),
    new Paragraph({
      spacing: { after: 120 },
      children: [new TextRun({ text: draft.title, font: FONT, size: 22, italics: true, color: GREY })],
    }),
    new Paragraph({
      spacing: { after: 280 },
      children: [
        new TextRun({ text: "Full text: ", font: FONT, size: 20, color: GREY }),
        new ExternalHyperlink({
          link: draft.url,
          children: [new TextRun({ text: draft.url, font: FONT, size: 20, style: "Hyperlink" })],
        }),
      ],
    }),
    // The credit: a shaded box with a navy rule on the left. The routine's
    // summaries say they were generated; a colleague's say who wrote it.
    new Paragraph({
      shading: { type: ShadingType.CLEAR, fill: "EEF2F8", color: "auto" },
      border: { left: { style: BorderStyle.SINGLE, size: 24, color: NAVY, space: 10 } },
      indent: { left: 0 },
      spacing: { before: 60, after: 60, line: 276 },
      children: generated
        ? [
            new TextRun({ text: "AI-generated summary. ", font: FONT, size: 18, bold: true, color: NAVY }),
            new TextRun({
              text:
                `Prepared automatically by Claude for Omni Law Firm on ${madeOn} from the full text of the decision ` +
                "published on constcourt.gov.az, following the firm's method for summarising Constitutional Court " +
                "decisions. The passages below are quoted verbatim from the decision, in Azerbaijani; the selection " +
                "and the emphasis are the summariser's, and the only words that are not the Court's stand in square " +
                "brackets and come from the statute. It is not legal advice and has not been reviewed by a lawyer: " +
                "check the original before citing it.",
              font: FONT,
              size: 18,
              color: INK,
            }),
          ]
        : [
            new TextRun({ text: `Summary by ${author}. `, font: FONT, size: 18, bold: true, color: NAVY }),
            new TextRun({
              text:
                (draft.circulated_at ? `Circulated to the firm by email on ${longDate(draft.circulated_at)}. ` : "") +
                "The passages below are quoted verbatim from the decision, in Azerbaijani; the selection and the " +
                "emphasis are the author's. Laid out for the firm's library" +
                ` on ${madeOn}. Check the original before citing it.`,
              font: FONT,
              size: 18,
              color: INK,
            }),
          ],
    }),
    new Paragraph({
      spacing: { before: 120, after: 0 },
      children: [new TextRun({ text: tags, font: FONT, size: 16, color: GREY, allCaps: true, characterSpacing: 30 })],
    }),
    new Paragraph({
      spacing: { before: 320, after: 200, line: 300 },
      children: [
        new TextRun({ text: "Topic — ", font: FONT, size: 23, bold: true, italics: true, color: INK }),
        new TextRun({ text: draft.topic, font: FONT, size: 23, bold: true, italics: true, color: INK }),
      ],
    }),
    new Paragraph({
      spacing: { after: 160 },
      children: [
        new TextRun({ text: "The Court's important positions", font: FONT, size: 22, bold: true, color: INK }),
        new TextRun({ text: "  (verbatim excerpts, in Azerbaijani)", font: FONT, size: 20, color: GREY }),
      ],
    }),
  ];

  for (const block of draft.blocks) {
    if (block.heading) {
      body.push(
        new Paragraph({
          spacing: { before: 200, after: 120 },
          children: [new TextRun({ text: block.heading, font: FONT, size: 22, bold: true, underline: { type: "single" }, color: INK })],
        }),
      );
    }
    for (const bullet of block.bullets) {
      body.push(
        new Paragraph({
          numbering: { reference: "summary-bullets", level: 0 },
          spacing: { after: 140, line: 276 },
          alignment: AlignmentType.JUSTIFIED,
          children: runs(bullet.text, { font: FONT, size: 22, color: INK }),
        }),
      );
      for (const sub of bullet.sub ?? []) {
        body.push(
          new Paragraph({
            numbering: { reference: "summary-bullets", level: 1 },
            spacing: { after: 80, line: 276 },
            alignment: AlignmentType.JUSTIFIED,
            children: runs(sub, { font: FONT, size: 22, color: INK, italics: true }),
          }),
        );
      }
    }
  }

  body.push(
    new Paragraph({
      spacing: { before: 360, after: 0 },
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: "D1D5DB", space: 8 } },
      children: [
        new TextRun({
          text: `Source: Constitutional Court of the Republic of Azerbaijan, Plenum, ${kind} of ${dottedDate(draft.decision_date)} — `,
          font: FONT,
          size: 17,
          color: GREY,
        }),
        new ExternalHyperlink({
          link: draft.url,
          children: [new TextRun({ text: draft.url.replace(/^https?:\/\//, ""), font: FONT, size: 17, style: "Hyperlink" })],
        }),
        new TextRun({ text: ` · Published at `, font: FONT, size: 17, color: GREY }),
        new ExternalHyperlink({
          link,
          children: [new TextRun({ text: link.replace(/^https?:\/\//, ""), font: FONT, size: 17, style: "Hyperlink" })],
        }),
      ],
    }),
  );

  const doc = new Document({
    creator: generated ? "Claude for Omni Law Firm" : `${author}, Omni Law Firm`,
    title: `${kind} ${dottedDate(draft.decision_date)} — ${draft.topic}`,
    description: generated ? "AI-generated summary of a Constitutional Court decision" : `Summary of a Constitutional Court decision by ${author}`,
    styles: {
      default: { document: { run: { font: FONT, size: 22, color: INK } } },
      paragraphStyles: [],
    },
    numbering: {
      config: [
        {
          reference: "summary-bullets",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 0.75 * CM, hanging: 0.5 * CM } }, run: { color: NAVY } },
            },
            {
              level: 1,
              format: LevelFormat.BULLET,
              text: "◦",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 1.5 * CM, hanging: 0.5 * CM } }, run: { color: NAVY } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4
            margin: { top: 2 * CM, right: 2 * CM, bottom: 2 * CM, left: 2 * CM, header: 1 * CM, footer: 1 * CM },
          },
        },
        headers: { default: header },
        footers: { default: footer },
        children: body,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
