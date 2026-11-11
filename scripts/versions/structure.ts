/**
 * The act's structure out of e-qanun blocks: the preamble, the section
 * ("BİRİNCİ BÖLMƏ") and chapter ("I fəsil") headings, every article
 * ("Maddə 98-1. Title") with its paragraphs, and the closing part
 * (transitional provisions, signature) as it appears after the last article.
 * Paragraphs keep the marker characters of eqanun-html.ts, so the rebuild
 * can see which words an amendment added or removed.
 */

import { stripMarks, tidy, type Block } from "@/scripts/versions/eqanun-html";

export type Paragraph = { text: string; refs: number[] };

export type ArticleSource = {
  number: string;
  /** Title with markers (an amended title has added words in italics). */
  title: string;
  /** Endnotes the heading links to: changes to the article as a whole. */
  refs: number[];
  paragraphs: Paragraph[];
  /** The section and chapter the article sits in, as printed. */
  section: string;
  chapter: string;
};

export type Heading = { kind: "section" | "chapter"; label: string; title: string };

export type ActSource = {
  title: string;
  /** The lines under the title: adoption, entry into force, amendments. */
  intro: string[];
  preamble: string[];
  /** Sections, chapters and articles in reading order. */
  outline: ({ kind: "heading"; heading: Heading } | { kind: "article"; number: string })[];
  articles: ArticleSource[];
  /** Everything after the last article that belongs to the act (transitional provisions, date). */
  closing: { title: string; paragraphs: string[] }[];
};

const ARTICLE_RE = /^Maddə\s+(\d+(?:-\d+)?)\s*\.\s*(.*)$/s;
const SECTION_RE = /^(BİRİNCİ|İKİNCİ|ÜÇÜNCÜ|DÖRDÜNCÜ|BEŞİNCİ|ALTINCI|YEDDİNCİ|SƏKKİZİNCİ|DOQQUZUNCU|ONUNCU)\s+BÖLMƏ\.?$/i;
const CHAPTER_RE = /^([IVXLC]+)\s+fəsil$/i;
const END_RE = /^(İSTİFADƏ OLUNMUŞ MƏNBƏ|KONSTİTUSİYAYA EDİLMİŞ|.*DƏYİŞİKLİK VƏ ƏLAVƏLƏRİN SİYAHISI)/i;

/** Capital letters as Azerbaijani prints them ("Bİrİncİ" → "BİRİNCİ"). */
function upper(text: string): string {
  return text.replace(/i/g, "İ").replace(/ı/g, "I").toUpperCase();
}

/** Turns the blocks of an e-qanun act into its structure. */
export function readStructure(blocks: Block[]): ActSource {
  const plain = (b: Block) => tidy(stripMarks(b.text));
  const act: ActSource = { title: "", intro: [], preamble: [], outline: [], articles: [], closing: [] };
  let section = "";
  let chapter = "";
  let current: ArticleSource | null = null;
  let pending: Heading | null = null;
  let closing: { title: string; paragraphs: string[] } | null = null;
  let i = 0;

  // Title, the italic lines about adoption and amendments, then the preamble.
  while (i < blocks.length && !plain(blocks[i])) i++;
  act.title = plain(blocks[i++]);
  for (; i < blocks.length; i++) {
    const text = plain(blocks[i]);
    if (SECTION_RE.test(upper(text)) || ARTICLE_RE.test(text)) break;
    const allItalic = /^[^-]*$/.test(blocks[i].text.trim());
    if (allItalic && act.preamble.length === 0) act.intro.push(text);
    else act.preamble.push(text);
  }

  for (; i < blocks.length; i++) {
    const block = blocks[i];
    const text = plain(block);
    if (!text) continue;
    if (END_RE.test(upper(text))) break;
    const sectionMatch = SECTION_RE.exec(upper(text));
    if (sectionMatch) {
      // The section's name is the next block.
      const name = plain(blocks[i + 1] ?? block);
      i++;
      section = `${upper(text).replace(/\.$/, "")}. ${upper(name)}`;
      act.outline.push({ kind: "heading", heading: { kind: "section", label: upper(text).replace(/\.$/, ""), title: upper(name) } });
      current = null;
      continue;
    }
    const chapterMatch = CHAPTER_RE.exec(text);
    if (chapterMatch) {
      const name = plain(blocks[i + 1] ?? block);
      i++;
      chapter = `${chapterMatch[1]} fəsil. ${upper(name)}`;
      pending = { kind: "chapter", label: `${chapterMatch[1]} fəsil`, title: upper(name) };
      act.outline.push({ kind: "heading", heading: pending });
      current = null;
      continue;
    }
    const articleMatch = ARTICLE_RE.exec(text);
    if (articleMatch && !closing) {
      // Keep the title's markers: drop the "Maddə N." prefix from the marked text.
      const marked = block.text.replace(/^[-]*\s*Maddə[-\s]*\d+(?:-\d+)?[-\s]*\.\s*/, "");
      current = {
        number: articleMatch[1],
        title: tidy(marked),
        refs: block.refs,
        paragraphs: [],
        section,
        chapter,
      };
      act.articles.push(current);
      act.outline.push({ kind: "article", number: current.number });
      continue;
    }
    if (upper(text) === "KEÇİD MÜDDƏALARI") {
      closing = { title: text, paragraphs: [] };
      act.closing.push(closing);
      current = null;
      continue;
    }
    if (closing) {
      closing.paragraphs.push(text);
      continue;
    }
    if (current) {
      // An endnote marker on an empty line belongs to the paragraph before it.
      if (!text && block.refs.length && current.paragraphs.length) {
        current.paragraphs[current.paragraphs.length - 1].refs.push(...block.refs);
        continue;
      }
      current.paragraphs.push({ text: block.text, refs: block.refs });
    }
  }
  return act;
}
