#!/usr/bin/env node
/**
 * Omni Law Gazette — weekly collector.
 *
 * Lists the legal acts adopted in a period, as leads for the issue:
 *
 *   1. e-qanun.az, the official register (its public search API): every
 *      institution, with numbers. Acts appear there a few days late.
 *   2. The issuing institutions' own lists, which are same-day: president.az
 *      (decrees, orders, signed laws), nk.gov.az (Cabinet), meclis.gov.az
 *      (adopted laws and bills put to discussion) and constcourt.gov.az.
 *
 * Items from (2) that the register already has are folded into the
 * register's item; the rest are kept and marked with their source. Each
 * lead carries the page with the act's text, for writing its summary.
 *
 * Usage:
 *   npm run gazette:collect -- --from 2026-10-26 --to 2026-11-01 [--out leads.json]
 * Without --from/--to: the Monday–Sunday week before today.
 */

import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import type { EntryKind } from "@/scripts/gazette/draft";

type Lead = {
  kind: EntryKind;
  institution: string;
  number?: string;
  date: string; // YYYY-MM-DD
  title: string;
  url: string; // where readers find the act
  textUrl?: string; // where its full text can be read
  source: string;
};

type SourceReport = { source: string; url: string; ok: boolean; found: number; error?: string };

const UA = "Mozilla/5.0 (compatible; OmniLawGazette/2.0; +https://ismayilhuquqbeledchisi.vercel.app/gazette)";

const PRESIDENT = "Azərbaycan Respublikasının Prezidenti";
const CABINET = "Nazirlər Kabineti";
const MAJLIS = "Milli Məclis";
const CONST_COURT = "Konstitusiya Məhkəməsi";

// ── Period ────────────────────────────────────────────────────────────────────

const { values } = parseArgs({
  options: { from: { type: "string" }, to: { type: "string" }, out: { type: "string" } },
});

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function lastWeek(): { from: string; to: string } {
  const today = new Date(`${iso(new Date())}T00:00:00Z`);
  const sinceMonday = (today.getUTCDay() + 6) % 7;
  const monday = new Date(today.getTime() - (sinceMonday + 7) * 86_400_000);
  return { from: iso(monday), to: iso(new Date(monday.getTime() + 6 * 86_400_000)) };
}

const period = values.from && values.to ? { from: values.from, to: values.to } : lastWeek();
const inPeriod = (date: string) => date >= period.from && date <= period.to;

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avqust", "sentyabr", "oktyabr", "noyabr", "dekabr"];

/** "28 oktyabr 2026", "30 Oktyabr 2026 - 13:12" → "2026-10-28". */
function azDate(text: string): string | null {
  const m = /(\d{1,2})\s+([A-Za-zƏəİıÖöÜüĞğŞşÇç]+)\s+(\d{4})/.exec(text);
  if (!m) return null;
  const month = MONTHS.indexOf(m[2].toLocaleLowerCase("az"));
  if (month < 0) return null;
  return `${m[3]}-${String(month + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

/** "26.10.2026" or "20.10.26" → "2026-10-26". */
function dottedDate(text: string): string | null {
  const m = /(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})\b/.exec(text);
  if (!m) return null;
  const year = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${year}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

function clean(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** president.az ends titles with the act's name: "… haqqında Azərbaycan Respublikası Prezidentinin Sərəncamı". */
function stripActName(title: string): string {
  return title
    .replace(/\s*Azərbaycan Respublikası(nın)? Prezidentinin (Fərmanı|Sərəncamı)\s*$/u, "")
    .replace(/\s*Azərbaycan Respublikasının (Konstitusiya )?Qanunu\s*$/u, "")
    .trim();
}

/** Comparable form of a title: letters and digits only, lower case. */
function titleKey(title: string): string {
  return stripActName(title)
    .toLocaleLowerCase("az")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .slice(0, 70);
}

/** Same act by title: one key is the start of the other, and long enough to mean it. */
function sameTitle(a: string, b: string): boolean {
  const [x, y] = [titleKey(a), titleKey(b)];
  const n = Math.min(x.length, y.length);
  return n >= 25 && x.slice(0, n) === y.slice(0, n);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** GET with a timeout and three attempts: some of these sites drop connections. */
async function get(url: string, accept = "text/html"): Promise<string> {
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: accept, "Accept-Language": "az" },
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      last = e;
      await sleep(1500 * (attempt + 1));
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}

// ── Sources ───────────────────────────────────────────────────────────────────

/** e-qanun's register type → kind and institution. */
function registerKind(typeName: string): { kind: EntryKind; institution: string } {
  const t = typeName.toLocaleUpperCase("az");
  if (t.includes("KONSTİTUSİYA MƏHKƏMƏSİ")) return { kind: "court", institution: CONST_COURT };
  if (t === "QANUNLAR" || t.includes("KONSTİTUSİYA QANUN")) return { kind: "law", institution: MAJLIS };
  if (t.includes("MİLLİ MƏCLİS")) return { kind: "decision", institution: MAJLIS };
  if (t.includes("PREZİDENTİNİN FƏRMAN")) return { kind: "decree", institution: PRESIDENT };
  if (t.includes("PREZİDENTİNİN SƏRƏNCAM")) return { kind: "order", institution: PRESIDENT };
  if (t.includes("NAZİRLƏR KABİNETİNİN QƏRAR")) return { kind: "decision", institution: CABINET };
  if (t.includes("NAZİRLƏR KABİNETİNİN SƏRƏNCAM")) return { kind: "order", institution: CABINET };
  if (t.includes("MƏRKƏZİ BANK")) return { kind: "decision", institution: "Mərkəzi Bank" };
  if (t.includes("SEÇKİ KOMİSSİYA")) return { kind: "decision", institution: "Mərkəzi Seçki Komissiyası" };
  return { kind: "other", institution: typeName.trim() };
}

type RegisterRow = { id: number; title: string; typeName: string; acceptDate: string; citation: string | null };

async function eQanun(): Promise<Lead[]> {
  const leads: Lead[] = [];
  const pageSize = 100;
  for (let start = 0; start < 1000; start += pageSize) {
    const url =
      `https://api.e-qanun.az/getDetailSearch?start=${start}&length=${pageSize}` +
      "&orderColumn=8&orderDirection=desc&title=true&codeType=1&dateType=1&statusId=1&secondType=2&specialDate=false&array=";
    const body = JSON.parse(await get(url, "application/json")) as { data: RegisterRow[] };
    let older = false;
    for (const row of body.data) {
      const date = dottedDate(row.acceptDate);
      if (!date) continue;
      if (date < period.from) older = true;
      if (!inPeriod(date)) continue;
      leads.push({
        ...registerKind(row.typeName),
        ...(row.citation?.trim() ? { number: row.citation.trim() } : {}),
        date,
        title: row.title.trim(),
        url: `https://e-qanun.az/framework/${row.id}`,
        source: "e-qanun.az",
      });
    }
    // Newest first: once a page reaches acts older than the period, stop.
    if (older || body.data.length < pageSize) break;
  }
  return leads;
}

async function presidentAz(): Promise<Lead[]> {
  const categories: { path: string; kind: EntryKind; institution: string }[] = [
    { path: "decrees", kind: "decree", institution: PRESIDENT },
    { path: "orders", kind: "order", institution: PRESIDENT },
    { path: "laws", kind: "law", institution: MAJLIS }, // laws as signed by the President
  ];
  const leads: Lead[] = [];
  for (const cat of categories) {
    for (let page = 1; page <= 4; page++) {
      const html = await get(`https://president.az/az/documents/category/${cat.path}${page > 1 ? `/${page}` : ""}`);
      let older = false;
      let found = 0;
      for (const m of html.matchAll(/<article class="news-text">([\s\S]*?)<\/article>/g)) {
        const block = m[1];
        const href = /href="(\/az\/articles\/view\/\d+)"/.exec(block)?.[1];
        const date = azDate(clean(/class="category_date">([\s\S]*?)<\/span>/.exec(block)?.[1] ?? ""));
        const title = clean(/<a class="news-text_body"[^>]*>\s*<span>([\s\S]*?)<\/span>/.exec(block)?.[1] ?? "");
        if (!href || !date || !title) continue;
        found++;
        if (date < period.from) older = true;
        if (!inPeriod(date)) continue;
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
      if (older || found === 0) break;
    }
  }
  return leads;
}

async function nkGovAz(): Promise<Lead[]> {
  const leads: Lead[] = [];
  for (let page = 0; page <= 4; page++) {
    const html = await get(`https://nk.gov.az/az/senedler/hamisi${page > 0 ? `?page=${page}` : ""}`);
    let older = false;
    let found = 0;
    for (const m of html.matchAll(/<div class="col-12 p-2 doc-item">([\s\S]*?)<div class="doc-text/g)) {
      const block = m[1];
      const href = /href="([^"]+)"/.exec(block)?.[1];
      const title = clean(/class="doc-header[^"]*">([\s\S]*?)<\/p>/.exec(block)?.[1] ?? "");
      const type = clean(/class="doc-type">([\s\S]*?)<\/span>/.exec(block)?.[1] ?? "");
      const date = azDate(clean(/class="doc-date">([\s\S]*?)<\/span>/.exec(block)?.[1] ?? ""));
      const number = clean(/class="doc-num">([\s\S]*?)<\/span>/.exec(block)?.[1] ?? "").replace(/^№\s*/, "");
      if (!href || !title || !date) continue;
      found++;
      if (date < period.from) older = true;
      if (!inPeriod(date)) continue;
      // Letters (Məktublar) are correspondence, not acts.
      const kind: EntryKind | null = /qərar/i.test(type) ? "decision" : /sərəncam/i.test(type) ? "order" : null;
      if (!kind) continue;
      const url = new URL(href, "https://nk.gov.az").toString();
      leads.push({
        kind,
        institution: CABINET,
        ...(number ? { number } : {}),
        date,
        title,
        url,
        textUrl: url,
        source: "nk.gov.az",
      });
    }
    if (older || found === 0) break;
  }
  return leads;
}

async function meclisLaws(): Promise<Lead[]> {
  const html = await get("https://meclis.gov.az/cat-qanun.php?cat=72&lang=az");
  const leads: Lead[] = [];
  for (const m of html.matchAll(/<article class="post post-tp-24"[\s\S]*?<\/article>/g)) {
    const block = m[0];
    const head = clean(/<div[^>]*>([\s\S]*?)<\/div>/.exec(block)?.[1] ?? "");
    const date = azDate(head);
    const number = /Nömrə:\s*([0-9A-Za-z-]+)/.exec(head)?.[1];
    const link = /<a href="([^"]+)">([\s\S]*?)<\/a>/.exec(block);
    if (!date || !link || !inPeriod(date)) continue;
    const url = link[1].replace("meclis.gov.az//", "meclis.gov.az/");
    leads.push({
      kind: "law",
      institution: MAJLIS,
      ...(number ? { number } : {}),
      date,
      title: clean(link[2]),
      url,
      textUrl: url,
      source: "meclis.gov.az",
    });
  }
  return leads;
}

async function meclisBills(): Promise<Lead[]> {
  const html = await get("https://meclis.gov.az/cat-layihe.php?cat=83&lang=az");
  const leads: Lead[] = [];
  for (const m of html.matchAll(/<article class="post post-tp-24"[\s\S]*?<\/article>/g)) {
    const block = m[0];
    const date = azDate(clean(/<div[^>]*>([\s\S]*?)<\/div>/.exec(block)?.[1] ?? ""));
    const link = /<a href="(news-layihe\.php\?id=\d+[^"]*par=0)">([\s\S]*?)<\/a>/.exec(block);
    if (!date || !link || !inPeriod(date)) continue;
    const url = `https://meclis.gov.az/${link[1].replace(/&amp;/g, "&")}`;
    leads.push({ kind: "bill", institution: MAJLIS, date, title: clean(link[2]), url, textUrl: url, source: "meclis.gov.az" });
  }
  return leads;
}

async function constCourt(): Promise<Lead[]> {
  const html = await get("https://constcourt.gov.az/az/decisions");
  const leads: Lead[] = [];
  for (const m of html.matchAll(/<a href="(https:\/\/constcourt\.gov\.az\/az\/decision\/\d+)">([\s\S]*?)<\/a>/g)) {
    const text = clean(m[2]);
    const date = dottedDate(text);
    if (!date || !inPeriod(date)) continue;
    const title = text.replace(/^\s*\d{1,2}\.\d{1,2}\.\d{2,4}\s*/, "");
    leads.push({ kind: "court", institution: CONST_COURT, date, title, url: m[1], textUrl: m[1], source: "constcourt.gov.az" });
  }
  return leads;
}

// ── Merge ─────────────────────────────────────────────────────────────────────

/**
 * Folds an institution's item into the register's copy of the same act
 * (same kind and number, or the same title), keeping the register's link
 * for readers and the institution's page for the text.
 */
function merge(register: Lead[], extra: Lead[]): Lead[] {
  const out = [...register];
  for (const item of extra) {
    const twin = out.find(
      (r) =>
        r.kind === item.kind &&
        ((r.number && item.number && r.number.toLowerCase() === item.number.toLowerCase()) ||
          sameTitle(r.title, item.title))
    );
    if (twin) {
      twin.textUrl ??= item.textUrl;
      twin.number ??= item.number;
    } else {
      out.push(item);
    }
  }
  return out;
}

async function main() {
  console.log(`\n📰 Omni Law Gazette collector — ${period.from} → ${period.to}\n`);

  const sources: [string, string, () => Promise<Lead[]>][] = [
    ["e-qanun.az", "https://e-qanun.az", eQanun],
    ["president.az", "https://president.az/az/documents", presidentAz],
    ["nk.gov.az", "https://nk.gov.az/az/senedler/hamisi", nkGovAz],
    ["meclis.gov.az (qanunlar)", "https://meclis.gov.az/cat-qanun.php?cat=72&lang=az", meclisLaws],
    ["meclis.gov.az (layihələr)", "https://meclis.gov.az/cat-layihe.php?cat=83&lang=az", meclisBills],
    ["constcourt.gov.az", "https://constcourt.gov.az/az/decisions", constCourt],
  ];

  const reports: SourceReport[] = [];
  const results = new Map<string, Lead[]>();
  for (const [name, url, run] of sources) {
    try {
      const leads = await run();
      results.set(name, leads);
      reports.push({ source: name, url, ok: true, found: leads.length });
      console.log(`   ✓ ${name.padEnd(26)} ${leads.length}`);
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      reports.push({ source: name, url, ok: false, found: 0, error });
      console.log(`   ✗ ${name.padEnd(26)} ${error}`);
    }
  }

  let leads = results.get("e-qanun.az") ?? [];
  for (const [name, list] of results) if (name !== "e-qanun.az") leads = merge(leads, list);

  const order = [MAJLIS, PRESIDENT, CABINET, CONST_COURT];
  const rank = (i: string) => (order.includes(i) ? order.indexOf(i) : order.length);
  leads.sort((a, b) => rank(a.institution) - rank(b.institution) || a.institution.localeCompare(b.institution, "az") || a.date.localeCompare(b.date));

  const out = values.out ?? `gazette-leads-${period.to}.json`;
  writeFileSync(out, JSON.stringify({ period, generated_at: new Date().toISOString(), sources: reports, leads }, null, 2));

  const byInstitution = new Map<string, number>();
  for (const l of leads) byInstitution.set(l.institution, (byInstitution.get(l.institution) ?? 0) + 1);
  console.log(`\n   ${leads.length} act(s):`);
  for (const [institution, n] of byInstitution) console.log(`     ${String(n).padStart(3)}  ${institution}`);
  console.log(`\n✓ Leads saved: ${out}\n`);

  if (reports.every((r) => !r.ok)) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
