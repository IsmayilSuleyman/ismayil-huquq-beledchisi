#!/usr/bin/env node
/**
 * Omni Law Gazette — act reader.
 *
 * Prints the text of a legal act from the page a lead points to, so the
 * weekly routine reads the operative part before summarising. It knows
 * where each source keeps the text:
 *
 *   president.az       the article body, or the PDF it links instead
 *   nk.gov.az          the PDF embedded in the page
 *   meclis.gov.az      a bill's text and its reading stage; laws are PDFs
 *   constcourt.gov.az  the ruling's paragraphs
 *   e-qanun.az         the register's details only (its text files are
 *                      not public); read the issuing body's page instead
 *
 * Usage:
 *   npm run gazette:read -- <url> [--max 15000] [--reading 2]
 *
 * --reading picks a bill's reading (1 = first); by default the latest.
 */

import { parseArgs } from "node:util";
import { fetchWithRetry, getText } from "@/scripts/gazette/http";
import { cleanHtml, parseBillReadings } from "@/scripts/gazette/leads";
import { pdfText } from "@/scripts/gazette/pdf-text";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { max: { type: "string", default: "15000" }, reading: { type: "string" } },
});

/** Paragraph-aware text of an HTML fragment. */
function blockText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(p|div|li|tr|h\d)>|<br\s*\/?>/gi, "\n")
    .split("\n")
    .map((line) => cleanHtml(line))
    .filter(Boolean)
    .join("\n");
}

/** The first element with this class, up to its matching closing tag. */
function elementByClass(html: string, cls: string): string | null {
  const open = new RegExp(`<(div|section|article)\\b[^>]*class="[^"]*\\b${cls}\\b[^"]*"[^>]*>`, "i").exec(html);
  if (!open) return null;
  const tag = open[1].toLowerCase();
  const re = new RegExp(`<${tag}\\b|</${tag}>`, "gi");
  re.lastIndex = open.index + open[0].length;
  let depth = 1;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    depth += m[0].startsWith("</") ? -1 : 1;
    if (depth === 0) return html.slice(open.index + open[0].length, m.index);
  }
  return html.slice(open.index + open[0].length);
}

async function fromPdf(url: string): Promise<string> {
  const res = await fetchWithRetry(url, "application/pdf");
  return pdfText(new Uint8Array(await res.arrayBuffer()));
}

/** Every PDF a page embeds or links, in page order, without repeats. */
function allPdfLinks(html: string, base: string): string[] {
  const found: string[] = [];
  for (const m of html.matchAll(/<(?:iframe|embed)\b[^>]*\bsrc="([^"]+\.pdf[^"]*)"|<a\b[^>]*\bhref="([^"]+\.pdf[^"]*)"/gi)) {
    const url = new URL((m[1] ?? m[2]).replace(/&amp;/g, "&"), base).toString();
    if (!found.includes(url)) found.push(url);
  }
  return found;
}

function firstPdfLink(html: string, base: string): string | null {
  const src =
    /<(?:iframe|embed)\b[^>]*\bsrc="([^"]+\.pdf[^"]*)"/i.exec(html)?.[1] ??
    /<object\b[^>]*\bdata="([^"]+\.pdf[^"]*)"/i.exec(html)?.[1] ??
    /<a\b[^>]*\bhref="([^"]+\.pdf[^"]*)"/i.exec(html)?.[1];
  return src ? new URL(src.replace(/&amp;/g, "&"), base).toString() : null;
}

type Read = { from: string; text: string };

async function read(url: string): Promise<Read> {
  const host = new URL(url).hostname.replace(/^www\./, "");

  if (/\.pdf($|\?)/i.test(url)) return { from: "PDF", text: await fromPdf(url) };

  if (host === "e-qanun.az") {
    const id = /framework\/(\d+)/.exec(url)?.[1];
    if (!id) throw new Error("Not an e-qanun.az framework link");
    const data = JSON.parse(await getText(`https://api.e-qanun.az/framework/${id}`, "application/json")).data;
    const r = data.requisite;
    const lines = [
      r.title,
      `Növ: ${r.typeName}`,
      `Qəbul tarixi: ${r.acceptDate}`,
      r.citation ? `Nömrə: ${r.citation}` : null,
      `Status: ${r.statusName}`,
      r.effectDate ? `Qüvvəyə minmə: ${r.effectDate}` : null,
      ...(r.fields ?? []).map((f: { name: string; fieldName: string; fieldValue: string }) => `${f.name} — ${f.fieldName}: ${f.fieldValue}`),
      "",
      "(e-qanun.az does not serve its text files publicly; read the act on the issuing body's site.)",
    ];
    return { from: "e-qanun.az register details", text: lines.filter((l) => l !== null).join("\n") };
  }

  const html = await getText(url);

  if (host === "president.az") {
    const body = elementByClass(html, "news_paragraph-block") ?? "";
    const text = blockText(body);
    const pdf = firstPdfLink(body, url);
    if (pdf && text.replace(/PDF yükləyin/g, "").trim().length < 300) return { from: `PDF linked on the page (${pdf})`, text: await fromPdf(pdf) };
    return { from: "article body", text };
  }

  if (host === "nk.gov.az") {
    // The act first, then any annex (rules, a regulation) in further PDFs.
    const pdfs = allPdfLinks(html, url).filter((u) => u.includes("/uploads/"));
    if (pdfs.length === 0) throw new Error("No PDF found on the nk.gov.az page");
    const parts: string[] = [];
    for (const [i, pdf] of pdfs.entries()) {
      parts.push(`${i === 0 ? "" : `\n\n=== Annex ${i} (${pdf}) ===\n\n`}${await fromPdf(pdf)}`);
    }
    return { from: `${pdfs.length} PDF(s) on the page (${pdfs[0]}${pdfs.length > 1 ? " and annexes" : ""})`, text: parts.join("") };
  }

  if (host === "meclis.gov.az") {
    // One pane per reading, in order; the list of readings says which is which.
    const readings = parseBillReadings(html);
    const body = (elementByClass(html, "tab-content") ?? "").split(/<form\b/i)[0];
    const panes = body.split(/<div class="tab-item"/).slice(1);
    const wanted = values.reading ? Number(values.reading) - 1 : readings.length - 1;
    if (values.reading && !(wanted >= 0 && wanted < panes.length)) {
      throw new Error(`This bill has ${readings.length} reading(s); --reading ${values.reading} is not one of them`);
    }
    const text = blockText(panes[wanted] !== undefined ? `<div ${panes[wanted]}` : body);
    const list = readings.map((r) => `${r.stage}: ${r.date ?? "date not shown"}`).join("; ");
    return {
      from: `bill page. Readings: ${list || "none listed"}. Text of the ${values.reading ? "chosen" : "latest"} (${readings[wanted]?.stage ?? "?"}); use the stage whose date is in your period (--reading N for another)`,
      text,
    };
  }

  // constcourt.gov.az and anything else: the page's paragraphs, or an embedded PDF.
  const paragraphs = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => cleanHtml(m[1])).filter(Boolean);
  const text = paragraphs.join("\n");
  if (text.length >= 400) return { from: "page paragraphs", text };
  const pdf = firstPdfLink(html, url);
  if (pdf) return { from: `PDF linked on the page (${pdf})`, text: await fromPdf(pdf) };
  return {
    from: "page text (if this is only menus, the page builds its content with JavaScript: find the text elsewhere)",
    text: blockText(html),
  };
}

async function main() {
  const url = positionals[0];
  if (!url) {
    console.error("Usage: npm run gazette:read -- <url> [--max 15000]");
    process.exit(2);
  }
  const max = Number(values.max) || 15000;
  const { from, text } = await read(url);
  const clipped = text.length > max ? `${text.slice(0, max)}\n\n[… ${text.length - max} more characters; raise --max to read on]` : text;
  console.log(`URL: ${url}\nText from: ${from}\nLength: ${text.length} characters\n\n${clipped}`);
  if (text.trim().length < 80) {
    console.error("\n! Almost no text found; open the page another way or leave the summary to the title.");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
