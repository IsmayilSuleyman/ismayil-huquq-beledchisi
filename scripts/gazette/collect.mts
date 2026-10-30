#!/usr/bin/env node
/**
 * Omni Law Gazette — weekly collector.
 *
 * Lists the legal acts of a period, as leads for the issue:
 *
 *   1. e-qanun.az, the official register (its public search API): every
 *      institution, with numbers. Acts appear there a few days late.
 *   2. The issuing institutions' own lists, which are same-day: president.az
 *      (decrees, orders, signed laws), nk.gov.az (Cabinet), meclis.gov.az
 *      (bills put to discussion) and constcourt.gov.az.
 *
 * The same act listed by two sources becomes one lead. Laws are placed in
 * the week president.az published them as signed; the register and the
 * Majlis list of adopted laws only supply their numbers and adoption dates
 * (see enrichLaws in leads.ts). Each source reports whether it looked far
 * enough back to cover the whole period.
 *
 * Usage:
 *   npm run gazette:collect -- --from 2026-10-26 --to 2026-11-01 [--out leads.json]
 * Without --from/--to: the Monday–Sunday week before today.
 */

import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import {
  CABINET,
  CONST_COURT,
  MAJLIS,
  PRESIDENT,
  addDays,
  azDate,
  cleanHtml,
  dottedDate,
  enrichLaws,
  isAnnex,
  mergeLeads,
  registerKind,
  sortLeads,
  stripActName,
  type Lead,
} from "@/scripts/gazette/leads";
import type { EntryKind } from "@/scripts/gazette/draft";
import { getText, retryCount } from "@/scripts/gazette/http";

// ── Period ────────────────────────────────────────────────────────────────────

const { values } = parseArgs({
  options: { from: { type: "string" }, to: { type: "string" }, out: { type: "string" } },
});

function lastWeek(): { from: string; to: string } {
  // Baku is UTC+4 all year; the routine runs on Monday morning there.
  const today = new Date(Date.now() + 4 * 3_600_000).toISOString().slice(0, 10);
  const sinceMonday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
  const monday = addDays(today, -(sinceMonday + 7));
  return { from: monday, to: addDays(monday, 6) };
}

const period = values.from && values.to ? { from: values.from, to: values.to } : lastWeek();
const inPeriod = (date: string) => date >= period.from && date <= period.to;

// ── Fetching ──────────────────────────────────────────────────────────────────

const get = getText;

/**
 * What a source found: the leads in the period, and the oldest date it saw.
 * Lists run newest first, so seeing a date before the period means the
 * whole period was covered.
 */
type Found = { leads: Lead[]; oldest: string | null };

function older(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}

// ── Sources ───────────────────────────────────────────────────────────────────

type RegisterRow = { id: number; title: string; typeName: string; acceptDate: string; citation: string | null };

/**
 * The register, newest first. Its laws come back separately: they are
 * dated by adoption, so they only lend numbers to the laws signed this
 * week, and the lookup reaches two months further back for them.
 */
async function eQanun(): Promise<Found & { laws: Lead[] }> {
  const leads: Lead[] = [];
  const laws: Lead[] = [];
  const lawsFrom = addDays(period.from, -75);
  let oldest: string | null = null;
  const pageSize = 100;
  for (let start = 0; start < 2000; start += pageSize) {
    const url =
      `https://api.e-qanun.az/getDetailSearch?start=${start}&length=${pageSize}` +
      "&orderColumn=8&orderDirection=desc&title=true&codeType=1&dateType=1&statusId=1&secondType=2&specialDate=false&array=";
    const body = JSON.parse(await get(url, "application/json")) as { data: RegisterRow[] };
    for (const row of body.data) {
      const date = dottedDate(row.acceptDate);
      if (!date) continue;
      oldest = older(oldest, date);
      const lead: Lead = {
        ...registerKind(row.typeName),
        ...(row.citation?.trim() ? { number: row.citation.trim() } : {}),
        date,
        title: row.title.trim(),
        url: `https://e-qanun.az/framework/${row.id}`,
        source: "e-qanun.az",
      };
      if (lead.kind === "law") {
        if (date >= lawsFrom && date <= period.to) laws.push(lead);
      } else if (inPeriod(date)) {
        leads.push(lead);
      }
    }
    if ((oldest && oldest < lawsFrom) || body.data.length < pageSize) break;
  }
  return { leads, laws, oldest };
}

async function presidentAz(): Promise<Found> {
  const categories: { path: string; kind: EntryKind; institution: string }[] = [
    { path: "decrees", kind: "decree", institution: PRESIDENT },
    { path: "orders", kind: "order", institution: PRESIDENT },
    { path: "laws", kind: "law", institution: MAJLIS }, // dated by their publication as signed
  ];
  const leads: Lead[] = [];
  let covered: string | null = null; // the least far back any category reached
  for (const [i, cat] of categories.entries()) {
    let oldest: string | null = null;
    // About a dozen per page; enough pages to reach back a couple of months.
    for (let page = 1; page <= 12; page++) {
      const html = await get(`https://president.az/az/documents/category/${cat.path}${page > 1 ? `/${page}` : ""}`);
      let found = 0;
      for (const m of html.matchAll(/<article class="news-text">([\s\S]*?)<\/article>/g)) {
        const block = m[1];
        const href = /href="(\/az\/articles\/view\/\d+)"/.exec(block)?.[1];
        const date = azDate(cleanHtml(/class="category_date">([\s\S]*?)<\/span>/.exec(block)?.[1] ?? ""));
        const title = cleanHtml(/<a class="news-text_body"[^>]*>\s*<span>([\s\S]*?)<\/span>/.exec(block)?.[1] ?? "");
        if (!href || !date || !title) continue;
        found++;
        oldest = older(oldest, date);
        if (!inPeriod(date) || isAnnex(title)) continue;
        const url = `https://president.az${href}`;
        leads.push({
          kind: cat.kind,
          institution: cat.institution,
          date,
          title: stripActName(title),
          url,
          textUrl: url,
          source: "president.az",
        });
      }
      if (found === 0 || (oldest && oldest < period.from)) break;
    }
    // The source covers the period only if every category reached before it.
    if (i === 0) covered = oldest;
    else if (oldest === null || (covered !== null && oldest > covered)) covered = oldest;
  }
  return { leads, oldest: covered };
}

async function nkGovAz(): Promise<Found> {
  const leads: Lead[] = [];
  let oldest: string | null = null;
  for (let page = 0; page <= 8; page++) {
    const html = await get(`https://nk.gov.az/az/senedler/hamisi${page > 0 ? `?page=${page}` : ""}`);
    let found = 0;
    for (const m of html.matchAll(/<div class="col-12 p-2 doc-item">([\s\S]*?)<div class="doc-text/g)) {
      const block = m[1];
      const href = /href="([^"]+)"/.exec(block)?.[1];
      const title = cleanHtml(/class="doc-header[^"]*">([\s\S]*?)<\/p>/.exec(block)?.[1] ?? "");
      const type = cleanHtml(/class="doc-type">([\s\S]*?)<\/span>/.exec(block)?.[1] ?? "");
      const date = azDate(cleanHtml(/class="doc-date">([\s\S]*?)<\/span>/.exec(block)?.[1] ?? ""));
      const number = cleanHtml(/class="doc-num">([\s\S]*?)<\/span>/.exec(block)?.[1] ?? "").replace(/^№\s*/, "");
      if (!href || !title || !date) continue;
      found++;
      oldest = older(oldest, date);
      if (!inPeriod(date)) continue;
      // Letters (Məktublar) are correspondence, not acts.
      const kind: EntryKind | null = /qərar/i.test(type) ? "decision" : /sərəncam/i.test(type) ? "order" : null;
      if (!kind) continue;
      const url = new URL(href, "https://nk.gov.az").toString();
      leads.push({ kind, institution: CABINET, ...(number ? { number } : {}), date, title, url, textUrl: url, source: "nk.gov.az" });
    }
    if (found === 0 || (oldest && oldest < period.from)) break;
  }
  return { leads, oldest };
}

/** One page of a meclis.gov.az list (p is zero-based). */
function meclisPage(script: string, cat: number, page: number): Promise<string> {
  return get(`https://meclis.gov.az/${script}?${page > 0 ? `p=${page}&` : ""}cat=${cat}&lang=az`);
}

/** Adopted laws, by adoption date: numbers and text links for the laws signed this week. */
async function meclisLaws(): Promise<Lead[]> {
  const laws: Lead[] = [];
  const from = addDays(period.from, -75);
  for (let page = 0; page <= 6; page++) {
    const html = await meclisPage("cat-qanun.php", 72, page);
    let oldest: string | null = null;
    let found = 0;
    for (const m of html.matchAll(/<article class="post post-tp-24"[\s\S]*?<\/article>/g)) {
      const head = cleanHtml(/<div[^>]*>([\s\S]*?)<\/div>/.exec(m[0])?.[1] ?? "");
      const date = azDate(head);
      const number = /Nömrə:\s*([0-9A-Za-z-]+)/.exec(head)?.[1];
      const link = /<a href="([^"]+)">([\s\S]*?)<\/a>/.exec(m[0]);
      if (!date || !link) continue;
      found++;
      oldest = older(oldest, date);
      if (date < from || date > period.to) continue;
      const url = link[1].replace("meclis.gov.az//", "meclis.gov.az/");
      laws.push({
        kind: "law",
        institution: MAJLIS,
        ...(number ? { number } : {}),
        date,
        title: cleanHtml(link[2]),
        url,
        textUrl: url,
        source: "meclis.gov.az",
      });
    }
    if (found === 0 || (oldest && oldest < from)) break;
  }
  return laws;
}

async function meclisBills(): Promise<Found> {
  const leads: Lead[] = [];
  let oldest: string | null = null;
  for (let page = 0; page <= 6; page++) {
    const html = await meclisPage("cat-layihe.php", 83, page);
    let found = 0;
    for (const m of html.matchAll(/<article class="post post-tp-24"[\s\S]*?<\/article>/g)) {
      const date = azDate(cleanHtml(/<div[^>]*>([\s\S]*?)<\/div>/.exec(m[0])?.[1] ?? ""));
      const link = /<a href="(news-layihe\.php\?id=\d+[^"]*par=0)">([\s\S]*?)<\/a>/.exec(m[0]);
      if (!date || !link) continue;
      found++;
      oldest = older(oldest, date);
      if (!inPeriod(date)) continue;
      const url = `https://meclis.gov.az/${link[1].replace(/&amp;/g, "&")}`;
      leads.push({ kind: "bill", institution: MAJLIS, date, title: cleanHtml(link[2]), url, textUrl: url, source: "meclis.gov.az" });
    }
    if (found === 0 || (oldest && oldest < period.from)) break;
  }
  return { leads, oldest };
}

async function constCourt(): Promise<Found> {
  const leads: Lead[] = [];
  let oldest: string | null = null;
  for (let page = 1; page <= 5; page++) {
    const html = await get(`https://constcourt.gov.az/az/decisions${page > 1 ? `?key=&page=${page}` : ""}`);
    let found = 0;
    for (const m of html.matchAll(/<a href="(https:\/\/constcourt\.gov\.az\/az\/decision\/\d+)">([\s\S]*?)<\/a>/g)) {
      const text = cleanHtml(m[2]);
      const date = dottedDate(text);
      if (!date) continue;
      found++;
      oldest = older(oldest, date);
      if (!inPeriod(date)) continue;
      const title = text.replace(/^\s*\d{1,2}\.\d{1,2}\.\d{2,4}\s*/, "");
      leads.push({ kind: "court", institution: CONST_COURT, date, title, url: m[1], textUrl: m[1], source: "constcourt.gov.az" });
    }
    if (found === 0 || (oldest && oldest < period.from)) break;
  }
  return { leads, oldest };
}

// ── Main ──────────────────────────────────────────────────────────────────────

type SourceReport = { source: string; ok: boolean; found: number; complete: boolean; error?: string };

async function main() {
  console.log(`\n📰 Omni Law Gazette collector — ${period.from} → ${period.to}\n`);
  const reports: SourceReport[] = [];

  async function run<T extends Found>(source: string, fn: () => Promise<T>): Promise<T | null> {
    try {
      const result = await fn();
      const complete = result.oldest !== null && result.oldest < period.from;
      reports.push({ source, ok: true, found: result.leads.length, complete });
      const note = complete ? "" : "  (did not reach the start of the period)";
      console.log(`   ${complete ? "✓" : "!"} ${source.padEnd(26)} ${result.leads.length}${note}`);
      return result;
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      reports.push({ source, ok: false, found: 0, complete: false, error });
      console.log(`   ✗ ${source.padEnd(26)} ${error}`);
      return null;
    }
  }

  const register = await run("e-qanun.az", eQanun);
  const president = await run("president.az", presidentAz);
  const cabinet = await run("nk.gov.az", nkGovAz);
  const bills = await run("meclis.gov.az (layihələr)", meclisBills);
  const court = await run("constcourt.gov.az", constCourt);
  let adopted: Lead[] = [];
  try {
    adopted = await meclisLaws();
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.log(`   ✗ ${"meclis.gov.az (qanunlar)".padEnd(26)} ${error} (law numbers may be missing)`);
  }

  // Laws: published as signed this week (president.az), numbered from the register and the Majlis list.
  const presidentLeads = president?.leads ?? [];
  const signedLaws = enrichLaws(
    presidentLeads.filter((l) => l.kind === "law"),
    [...adopted, ...(register?.laws ?? [])]
  );

  let leads = register?.leads ?? [];
  leads = mergeLeads(leads, presidentLeads.filter((l) => l.kind !== "law"));
  leads = mergeLeads(leads, signedLaws);
  leads = mergeLeads(leads, cabinet?.leads ?? []);
  leads = mergeLeads(leads, bills?.leads ?? []);
  leads = mergeLeads(leads, court?.leads ?? []);
  leads = sortLeads(leads);

  const warnings: string[] = [];
  for (const r of reports) {
    if (!r.ok) warnings.push(`${r.source} failed: ${r.error}`);
    else if (!r.complete) warnings.push(`${r.source} did not reach the start of the period; acts from its first days may be missing`);
  }
  if (!president) warnings.push("Without president.az this week's signed laws cannot be determined");
  for (const law of signedLaws) {
    if (!law.number) warnings.push(`No number found for the signed law "${law.title.slice(0, 80)}…"; take it from its text`);
  }

  const retries = retryCount();
  const out = values.out ?? `gazette-leads-${period.to}.json`;
  writeFileSync(
    out,
    JSON.stringify({ period, generated_at: new Date().toISOString(), retries, sources: reports, warnings, leads }, null, 2)
  );

  const byInstitution = new Map<string, number>();
  for (const l of leads) byInstitution.set(l.institution, (byInstitution.get(l.institution) ?? 0) + 1);
  console.log(`\n   ${leads.length} act(s)${retries ? `, ${retries} retried request(s)` : ""}:`);
  for (const [institution, n] of byInstitution) console.log(`     ${String(n).padStart(3)}  ${institution}`);
  for (const w of warnings) console.log(`   ! ${w}`);
  console.log(`\n✓ Leads saved: ${out}\n`);

  if (reports.every((r) => !r.ok)) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
