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
 * Each act belongs to the week it was first published. Where president.az
 * or nk.gov.az lists an act, that listing's date decides its week, so an
 * act dated on a Friday but posted on the Monday after belongs to the next
 * issue, in a weekly run and in a catch-up run alike. Laws follow the same
 * rule; the register and the Majlis list date them by adoption and only
 * lend them numbers. Acts only the register has (ministries, the Central
 * Bank) count from their own date; in a weekly run, those registered late
 * are picked up for three more weeks.
 *
 * The same act from two sources becomes one lead. Each source reports
 * whether it looked back far enough to cover the whole period, and leads
 * that one of the last three issues already printed are marked.
 *
 * Usage:
 *   npm run gazette:collect -- --from 2026-10-26 --to 2026-11-01 [--out leads.json]
 * Without --from/--to: the Monday–Sunday week before today.
 */

import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/gazette/supabase";
import type { EntryKind } from "@/scripts/gazette/draft";
import { getText, retryCount } from "@/scripts/gazette/http";
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
  isActTitle,
  mergeLeads,
  registerKind,
  sameActAnyDate,
  sortLeads,
  stripActName,
  type Lead,
} from "@/scripts/gazette/leads";
import { printedIn, recentIssues } from "@/scripts/gazette/previous";

// ── Period ────────────────────────────────────────────────────────────────────

const { values } = parseArgs({
  options: { from: { type: "string" }, to: { type: "string" }, out: { type: "string" } },
});

// Baku is UTC+4 all year; the routine runs on Monday morning there.
const today = new Date(Date.now() + 4 * 3_600_000).toISOString().slice(0, 10);

function lastWeek(): { from: string; to: string } {
  const sinceMonday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
  const monday = addDays(today, -(sinceMonday + 7));
  return { from: monday, to: addDays(monday, 6) };
}

const period = values.from && values.to ? { from: values.from, to: values.to } : lastWeek();
const inPeriod = (date: string) => date >= period.from && date <= period.to;
/** A weekly run (the period just ended), as opposed to a catch-up run for an old week. */
const live = addDays(period.to, 8) >= today;
/** How far back the register is read: late registrations, and laws' adoption dates. */
const lateFrom = addDays(period.from, -21);
const lawsFrom = addDays(period.from, -75);

const get = getText;

/**
 * What a source found: everything it listed from the start of the period on
 * (later postings decide whether a register act belongs to a later week),
 * and the oldest date it saw. Lists run newest first, so seeing a date
 * before the period means the whole period was covered.
 */
type Found = { listed: Lead[]; oldest: string | null };

function older(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}

// ── Sources ───────────────────────────────────────────────────────────────────

type RegisterRow = { id: number; title: string; typeName: string; acceptDate: string; citation: string | null };

/**
 * The register, newest first, from today back to the laws' window, all
 * statuses (an act repealed soon after adoption still happened). Pages
 * overlap and rows are de-duplicated by id: rows sharing a date can swap
 * places between requests.
 */
async function eQanun(): Promise<Found> {
  const byId = new Map<number, Lead>();
  let oldest: string | null = null;
  const pageSize = 100;
  for (let start = 0; start < 3000; start += pageSize - 20) {
    const url =
      `https://api.e-qanun.az/getDetailSearch?start=${start}&length=${pageSize}` +
      "&orderColumn=8&orderDirection=desc&title=true&codeType=1&dateType=1&secondType=2&specialDate=false&array=";
    const body = JSON.parse(await get(url, "application/json")) as { data: RegisterRow[] };
    for (const row of body.data) {
      const date = dottedDate(row.acceptDate);
      if (!date) continue;
      oldest = older(oldest, date);
      if (date < lawsFrom || byId.has(row.id)) continue;
      byId.set(row.id, {
        ...registerKind(row.typeName),
        ...(row.citation?.trim() ? { number: row.citation.trim() } : {}),
        date,
        title: row.title.trim(),
        url: `https://e-qanun.az/framework/${row.id}`,
        source: "e-qanun.az",
      });
    }
    if ((oldest && oldest < lawsFrom) || body.data.length < pageSize) break;
  }
  return { listed: [...byId.values()], oldest };
}

async function presidentAz(): Promise<Found> {
  const categories: { path: string; kind: EntryKind; institution: string }[] = [
    { path: "decrees", kind: "decree", institution: PRESIDENT },
    { path: "orders", kind: "order", institution: PRESIDENT },
    { path: "laws", kind: "law", institution: MAJLIS }, // dated by their publication as signed
  ];
  const listed: Lead[] = [];
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
        // Skip what came before the period, and material posted alongside an act (charters, programmes).
        if (date < period.from || !isActTitle(title)) continue;
        const url = `https://president.az${href}`;
        listed.push({
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
  return { listed, oldest: covered };
}

async function nkGovAz(): Promise<Found> {
  const listed: Lead[] = [];
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
      if (date < period.from) continue;
      // Letters (Məktublar) are correspondence, not acts.
      const kind: EntryKind | null = /qərar/i.test(type) ? "decision" : /sərəncam/i.test(type) ? "order" : null;
      if (!kind) continue;
      const url = new URL(href, "https://nk.gov.az").toString();
      listed.push({ kind, institution: CABINET, ...(number ? { number } : {}), date, title, url, textUrl: url, source: "nk.gov.az" });
    }
    if (found === 0 || (oldest && oldest < period.from)) break;
  }
  return { listed, oldest };
}

/** One page of a meclis.gov.az list (p is zero-based). */
function meclisPage(script: string, cat: number, page: number): Promise<string> {
  return get(`https://meclis.gov.az/${script}?${page > 0 ? `p=${page}&` : ""}cat=${cat}&lang=az`);
}

/** Adopted laws, by adoption date: numbers and text links for the laws published this week. */
async function meclisLaws(): Promise<Lead[]> {
  const laws: Lead[] = [];
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
      if (date < lawsFrom || date > period.to) continue;
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
    if (found === 0 || (oldest && oldest < lawsFrom)) break;
  }
  return laws;
}

/** Bills by the date of their reading; undated ones are returned separately so none vanishes unseen. */
async function meclisBills(): Promise<Found & { undated: string[] }> {
  const listed: Lead[] = [];
  const undated: string[] = [];
  let oldest: string | null = null;
  for (let page = 0; page <= 6; page++) {
    const html = await meclisPage("cat-layihe.php", 83, page);
    let found = 0;
    for (const m of html.matchAll(/<article class="post post-tp-24"[\s\S]*?<\/article>/g)) {
      const link = /<a href="(news-layihe\.php\?id=\d+[^"]*par=0)">([\s\S]*?)<\/a>/.exec(m[0]);
      if (!link) continue;
      const date = azDate(cleanHtml(/<div[^>]*>([\s\S]*?)<\/div>/.exec(m[0])?.[1] ?? ""));
      const url = `https://meclis.gov.az/${link[1].replace(/&amp;/g, "&")}`;
      if (!date) {
        if (page === 0) undated.push(`${cleanHtml(link[2])} (${url})`);
        continue;
      }
      found++;
      oldest = older(oldest, date);
      if (!inPeriod(date)) continue;
      listed.push({ kind: "bill", institution: MAJLIS, date, title: cleanHtml(link[2]), url, textUrl: url, source: "meclis.gov.az" });
    }
    if (found === 0 || (oldest && oldest < period.from)) break;
  }
  return { listed, oldest, undated };
}

async function constCourt(): Promise<Found> {
  const listed: Lead[] = [];
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
      const title = text.replace(/^\s*\.?\s*\d{1,2}\.\d{1,2}\.\d{2,4}\s*/, "").replace(/^\.\s*/, "");
      listed.push({ kind: "court", institution: CONST_COURT, date, title, url: m[1], textUrl: m[1], source: "constcourt.gov.az" });
    }
    if (found === 0 || (oldest && oldest < period.from)) break;
  }
  return { listed, oldest };
}

// ── Placing acts in weeks ─────────────────────────────────────────────────────

/** Bodies whose acts only the register lists. */
const SAME_DAY_BODIES = [PRESIDENT, CABINET, MAJLIS, CONST_COURT];

/**
 * The register's acts that belong to this period: dated in it and not
 * posted after it by president.az or nk.gov.az (that posting's week owns
 * them). In a weekly run, register-only acts dated in the three weeks
 * before are added too, marked late: they were registered after their
 * week's issue went out.
 */
function registerLeads(register: Lead[], sameDay: Lead[]): Lead[] {
  return register.filter((r) => {
    if (r.kind === "law") return false; // laws come through president.az
    const postedLater = sameDay.some((s) => s.date > period.to && sameActAnyDate(s, r));
    if (inPeriod(r.date)) return !postedLater;
    if (live && r.date >= lateFrom && r.date < period.from && !SAME_DAY_BODIES.includes(r.institution)) {
      r.late = true;
      return true;
    }
    return false;
  });
}

/** A same-day listing takes the register's link, number and own date when the register has the act. */
function withRegisterDetails(lead: Lead, register: Lead[]): Lead {
  if (lead.source === "e-qanun.az") return lead;
  const twin = register.find((r) => sameActAnyDate(r, lead));
  if (!twin) return lead;
  return {
    ...lead,
    url: twin.url,
    number: lead.number ?? twin.number,
    actDate: lead.actDate ?? (twin.date !== lead.date ? twin.date : undefined),
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

type SourceReport = { source: string; ok: boolean; found: number; complete: boolean; error?: string };

async function main() {
  console.log(`\n📰 Omni Law Gazette collector — ${period.from} → ${period.to}${live ? "" : " (catch-up)"}\n`);
  const reports: SourceReport[] = [];

  async function run<T extends Found>(source: string, fn: () => Promise<T>, inWeek: (l: Lead) => boolean = (l) => inPeriod(l.date)) {
    try {
      const result = await fn();
      const complete = result.oldest !== null && result.oldest < period.from;
      const found = result.listed.filter(inWeek).length;
      reports.push({ source, ok: true, found, complete });
      const note = complete ? "" : "  (did not reach the start of the period)";
      console.log(`   ${complete ? "✓" : "!"} ${source.padEnd(26)} ${found}${note}`);
      return result;
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      reports.push({ source, ok: false, found: 0, complete: false, error });
      console.log(`   ✗ ${source.padEnd(26)} ${error}`);
      return null;
    }
  }

  const register = await run("e-qanun.az", eQanun, (l) => l.kind !== "law" && inPeriod(l.date));
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

  const registerAll = register?.listed ?? [];
  const presidentAll = president?.listed ?? [];
  const sameDay = [...presidentAll.filter((l) => l.kind !== "law"), ...(cabinet?.listed ?? [])];

  // Laws: published as signed this week (president.az), numbered from the register and the Majlis list.
  const laws = enrichLaws(
    presidentAll.filter((l) => l.kind === "law" && inPeriod(l.date)),
    [...adopted, ...registerAll.filter((l) => l.kind === "law")]
  );

  let leads = registerLeads(registerAll, sameDay);
  leads = mergeLeads(leads, sameDay.filter((l) => inPeriod(l.date)));
  leads = mergeLeads(leads, laws);
  leads = mergeLeads(leads, bills?.listed ?? []);
  leads = mergeLeads(leads, court?.listed ?? []);
  leads = sortLeads(leads.map((l) => withRegisterDetails(l, registerAll)));

  // Mark what the last issues already printed.
  try {
    const db = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
    const issues = await recentIssues(db, 3);
    for (const lead of leads) {
      const n = printedIn(lead, issues);
      if (n !== null) lead.printedIn = n;
    }
  } catch (e) {
    console.log(`   ! Could not compare with the last issues: ${e instanceof Error ? e.message : String(e)}`);
  }
  // A late act that was already printed is not news.
  leads = leads.filter((l) => !(l.late && l.printedIn));

  const warnings: string[] = [];
  for (const r of reports) {
    if (!r.ok) warnings.push(`${r.source} failed: ${r.error}`);
    else if (!r.complete) warnings.push(`${r.source} did not reach the start of the period; acts from its first days may be missing`);
  }
  if (!president) warnings.push("Without president.az this week's laws cannot be determined");
  for (const law of laws) {
    if (!law.number) warnings.push(`No number found for the law "${law.title.slice(0, 80)}…"; take it from its text`);
  }
  for (const bill of bills?.undated ?? []) warnings.push(`Undated bill on meclis.gov.az, check whether it belongs here: ${bill}`);
  for (const lead of leads) {
    if (lead.printedIn) warnings.push(`Already printed in No. ${lead.printedIn}: ${lead.kind} ${lead.number ?? ""} "${lead.title.slice(0, 60)}…"`);
  }

  const retries = retryCount();
  const out = values.out ?? `gazette-leads-${period.to}.json`;
  writeFileSync(
    out,
    JSON.stringify({ period, live, generated_at: new Date().toISOString(), retries, sources: reports, warnings, leads }, null, 2)
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
