#!/usr/bin/env node
/**
 * Omni Law Gazette — act finder.
 *
 * Finds where an act's text lives, so the routine can rebuild a clause as
 * it stands today from the original act and its amendments (ROUTINE.md,
 * step 3a.6): the register's text files are closed to scripts, but every
 * act is published in full by the body that issued it.
 *
 *   npm run gazette:find -- --register "946 nömrəli Fərman" [--from 2020-01-01] [--to 2026-11-01]
 *       The register's own search (api.e-qanun.az, the same API the
 *       collector uses) by title text: the original act and every act
 *       whose title names it, with id, type, date, number and title.
 *
 *   npm run gazette:find -- --president decrees --date 2020-02-27 [--days 1]
 *       The acts president.az lists under that category (decrees, orders,
 *       laws) on that date, found by binary search over the category's
 *       chronological pages; with their article links.
 *
 *   npm run gazette:find -- --nk --date 2011-07-18 [--number 120] [--days 1]
 *       The acts nk.gov.az lists on that date (and ±days), by binary
 *       search over its chronological listing; with number and link.
 *
 *   npm run gazette:find -- --toplusu "2025 4 341" [--kind decrees|decisions|laws]
 *       The act a Toplusu reference points at ("Azərbaycan Respublikasının
 *       Qanunvericilik Toplusu, 2025, № 4, maddə 341", as amending acts
 *       cite earlier amendments): the register's rows of that month, then
 *       a binary search on the article number through their entries.
 *
 * Several --date values may be given in one call; listing pages are cached
 * on disk for a day (GAZETTE_CACHE, default /tmp/gazette/find-cache), so a
 * chain of lookups costs far fewer requests than the first one.
 *
 * Read what it finds with `npm run gazette:read -- '<url>'`.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { getText as fetchText } from "@/scripts/gazette/http";

const CACHE_DIR = process.env.GAZETTE_CACHE ?? "/tmp/gazette/find-cache";
const CACHE_MS = 24 * 3_600_000;

/** getText with a day's disk cache, for listing pages and register entries that a chain of lookups reads again. */
async function getText(url: string, accept = "text/html"): Promise<string> {
  mkdirSync(CACHE_DIR, { recursive: true });
  const file = join(CACHE_DIR, `${createHash("sha1").update(url).digest("hex")}.txt`);
  if (existsSync(file) && Date.now() - statSync(file).mtimeMs < CACHE_MS) return readFileSync(file, "utf8");
  const text = await fetchText(url, accept);
  writeFileSync(file, text);
  return text;
}
import { azDate, cleanHtml } from "@/scripts/gazette/leads";

const { values } = parseArgs({
  options: {
    register: { type: "string" },
    from: { type: "string" },
    to: { type: "string" },
    limit: { type: "string", default: "40" },
    president: { type: "string" },
    nk: { type: "boolean", default: false },
    date: { type: "string", multiple: true },
    number: { type: "string" },
    days: { type: "string", default: "1" },
    toplusu: { type: "string" },
    kind: { type: "string" },
  },
});

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(2);
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "27.02.2020" → "2020-02-27". */
function dotted(text: string): string | null {
  const m = /(\d{2})\.(\d{2})\.(\d{4})/.exec(text);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

// ── The register ─────────────────────────────────────────────────────────────

type RegisterRow = { id: number; title: string; typeName: string; acceptDate: string; citation: string | null };

async function register(name: string, from?: string, to?: string, limit = 40) {
  const url =
    `https://api.e-qanun.az/getDetailSearch?start=0&length=${Math.min(limit, 100)}` +
    "&orderColumn=8&orderDirection=desc&title=true&codeType=1&dateType=1&secondType=2&specialDate=false&array=" +
    `&name=${encodeURIComponent(name)}`;
  const body = JSON.parse(await getText(url, "application/json")) as { data: RegisterRow[] };
  const rows = body.data
    .map((r) => ({ id: r.id, type: r.typeName, date: dotted(r.acceptDate) ?? r.acceptDate, number: r.citation?.trim() || null, title: r.title.trim() }))
    .filter((r) => (!from || r.date >= from) && (!to || r.date <= to))
    .sort((a, b) => a.date.localeCompare(b.date));
  console.log(`Register entries whose title has “${name}”${from || to ? ` (${from ?? "…"} – ${to ?? "…"})` : ""}: ${rows.length}\n`);
  for (const r of rows) {
    console.log(`${r.date}  ${r.number ? `№ ${r.number}` : "(no number)"}  ${r.type}\n    ${r.title}\n    https://e-qanun.az/framework/${r.id}\n`);
  }
  if (body.data.length >= Math.min(limit, 100)) console.log(`(the first ${body.data.length} only; raise --limit or narrow --from/--to)`);
}

// ── The register by date, and a Toplusu reference ───────────────────────────

const REGISTER_PAGE = 100;

async function registerPage(start: number): Promise<RegisterRow[]> {
  const url =
    `https://api.e-qanun.az/getDetailSearch?start=${start}&length=${REGISTER_PAGE}` +
    "&orderColumn=8&orderDirection=desc&title=true&codeType=1&dateType=1&secondType=2&specialDate=false&array=";
  return (JSON.parse(await getText(url, "application/json")) as { data: RegisterRow[] }).data;
}

const KIND_WORD: Record<string, RegExp> = {
  decrees: /PREZİDENTİNİN FƏRMANLARI/i,
  orders: /PREZİDENTİNİN SƏRƏNCAMLARI/i,
  decisions: /NAZİRLƏR KABİNETİNİN QƏRARLARI/i,
  laws: /^Qanunlar$|QANUNLARI$/i,
};

/** Register rows accepted in [from, to], newest first, found by bisecting the listing's offset. */
async function registerBetween(from: string, to: string, kind?: string): Promise<RegisterRow[]> {
  const dateOf = (r: RegisterRow) => dotted(r.acceptDate) ?? "";
  // Find an offset whose page reaches `to`, by doubling then bisecting.
  let lo = 0;
  let hi = REGISTER_PAGE;
  for (;;) {
    const rows = await registerPage(hi);
    if (rows.length === 0 || dateOf(rows[rows.length - 1]) <= to) break;
    lo = hi;
    hi *= 2;
    if (hi > 200_000) fail("The register listing does not reach that far back");
  }
  while (hi - lo > REGISTER_PAGE) {
    const mid = Math.floor((lo + hi) / 2 / REGISTER_PAGE) * REGISTER_PAGE;
    const rows = await registerPage(mid);
    if (rows.length === 0 || dateOf(rows[rows.length - 1]) <= to) hi = mid;
    else lo = mid;
  }
  const out: RegisterRow[] = [];
  for (let start = Math.max(0, hi - REGISTER_PAGE); ; start += REGISTER_PAGE) {
    const rows = await registerPage(start);
    if (rows.length === 0) break;
    out.push(...rows.filter((r) => dateOf(r) >= from && dateOf(r) <= to && (!kind || KIND_WORD[kind].test(r.typeName))));
    if (dateOf(rows[rows.length - 1]) < from) break;
  }
  const seen = new Set<number>();
  return out.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
}

type Requisite = { title: string; typeName: string; acceptDate: string; citation: string | null; fields?: { name: string; fieldName: string; fieldValue: string }[] };

/** The Toplusu article number of a register entry, or null when it has none yet. */
async function toplusuArticle(id: number): Promise<{ article: number | null; r: Requisite }> {
  const r = (JSON.parse(await getText(`https://api.e-qanun.az/framework/${id}`, "application/json")) as { data: { requisite: Requisite } }).data.requisite;
  const field = (r.fields ?? []).find((f) => /Qanunvericilik Toplusu/i.test(f.name) && /Maddə/i.test(f.fieldName));
  const n = field ? Number.parseInt(field.fieldValue, 10) : NaN;
  return { article: Number.isFinite(n) ? n : null, r };
}

/**
 * "2025, № 4, maddə 341": the Toplusu's issue N carries the acts of month
 * N (published a few weeks later), with article numbers rising through
 * the year; so the month's register rows are fetched and bisected on the
 * article number, a handful of entry reads.
 */
async function byToplusu(year: number, issue: number, article: number, kind?: string) {
  const first = new Date(Date.UTC(year, issue - 1, 1));
  // An issue takes the month's acts and the tail of the month before.
  const from = addDays(first.toISOString().slice(0, 10), -25);
  const to = addDays(new Date(Date.UTC(year, issue, 0)).toISOString().slice(0, 10), 15);
  // Article numbers follow the acts' own numbers within a day, not the register's ids.
  const num = (r: RegisterRow) => Number.parseInt((r.citation ?? "").replace(/\D/g, "") || "0", 10);
  const rows = (await registerBetween(from, to, kind)).sort((a, b) => (dotted(a.acceptDate) ?? "").localeCompare(dotted(b.acceptDate) ?? "") || num(a) - num(b) || a.id - b.id);
  console.log(`Toplusu ${year}, № ${issue}, maddə ${article}: ${rows.length} ${kind ?? "register"} row(s) between ${from} and ${to}`);
  if (rows.length === 0) return;
  let lo = 0;
  let hi = rows.length - 1;
  const tried = new Set<number>();
  while (lo <= hi) {
    let mid = Math.floor((lo + hi) / 2);
    let got = await toplusuArticle(rows[mid].id);
    tried.add(mid);
    // An entry without a Toplusu number yet: look at a neighbour instead.
    let step = 1;
    while (got.article === null && (mid + step <= hi || mid - step >= lo)) {
      const next = mid + step <= hi ? mid + step : mid - step;
      if (!tried.has(next)) {
        got = await toplusuArticle(rows[next].id);
        tried.add(next);
        if (got.article !== null) {
          mid = next;
          break;
        }
      }
      step++;
    }
    if (got.article === null) break;
    if (got.article === article) {
      const r = got.r;
      console.log(`★ ${dotted(r.acceptDate)}  ${r.citation ? `№ ${r.citation}  ` : ""}${r.typeName}
    ${r.title}
    https://e-qanun.az/framework/${rows[mid].id}`);
      return;
    }
    if (got.article < article) lo = mid + 1;
    else hi = mid - 1;
  }
  console.log("Not found in that month's rows; try the neighbouring issue number, or without --kind.");
}

// ── Chronological listings, found by binary search on the page number ───────

type Listed = { date: string; title: string; url: string; number?: string; type?: string };

/** Pages are newest first; returns the entries of page n and their oldest date, or null past the end. */
type PageReader = (n: number) => Promise<Listed[]>;

async function findDate(read: PageReader, first: number, date: string, days: number): Promise<Listed[]> {
  const cache = new Map<number, Listed[]>();
  const page = async (n: number) => {
    if (!cache.has(n)) cache.set(n, await read(n));
    return cache.get(n)!;
  };
  const oldest = (rows: Listed[]) => rows.reduce((o, r) => (r.date < o ? r.date : o), "9999");
  const newest = (rows: Listed[]) => rows.reduce((o, r) => (r.date > o ? r.date : o), "0000");

  // Grow until a page is older than the date (or empty), then bisect.
  let lo = first;
  let hi = first;
  for (;;) {
    const rows = await page(hi);
    if (rows.length === 0 || oldest(rows) <= date) break;
    lo = hi;
    hi = hi === 0 ? 1 : hi * 2;
    if (hi > 4096) fail("The listing does not reach that far back");
  }
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    const rows = await page(mid);
    if (rows.length === 0 || oldest(rows) <= date) hi = mid;
    else lo = mid;
  }
  // Page hi is the first whose oldest entry is on or before the date; the
  // date's acts may spill onto the page before and after.
  const lowBound = addDays(date, -days);
  const highBound = addDays(date, days);
  const out: Listed[] = [];
  for (let n = Math.max(first, hi - 1); ; n++) {
    const rows = await page(n);
    if (rows.length === 0) break;
    out.push(...rows.filter((r) => r.date >= lowBound && r.date <= highBound));
    if (oldest(rows) < lowBound) break;
    if (n > hi + 3) break;
    void newest;
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

async function presidentPage(category: string, n: number): Promise<Listed[]> {
  const html = await getText(`https://president.az/az/documents/category/${category}${n > 1 ? `/${n}` : ""}`);
  const rows: Listed[] = [];
  for (const m of html.matchAll(/<article class="news-text">([\s\S]*?)<\/article>/g)) {
    const block = m[1];
    const href = /href="(\/az\/articles\/view\/\d+)"/.exec(block)?.[1];
    const date = azDate(cleanHtml(/class="category_date">([\s\S]*?)<\/span>/.exec(block)?.[1] ?? ""));
    const title = cleanHtml(/<a class="news-text_body"[^>]*>\s*<span>([\s\S]*?)<\/span>/.exec(block)?.[1] ?? "");
    if (href && date && title) rows.push({ date, title, url: `https://president.az${href}` });
  }
  return rows;
}

async function nkPage(n: number): Promise<Listed[]> {
  const html = await getText(`https://nk.gov.az/az/senedler/hamisi${n > 0 ? `?page=${n}` : ""}`);
  const rows: Listed[] = [];
  for (const m of html.matchAll(/<div class="col-12 p-2 doc-item">([\s\S]*?)<div class="doc-text/g)) {
    const block = m[1];
    const href = /href="([^"]+)"/.exec(block)?.[1];
    const title = cleanHtml(/class="doc-header[^"]*">([\s\S]*?)<\/p>/.exec(block)?.[1] ?? "");
    const type = cleanHtml(/class="doc-type">([\s\S]*?)<\/span>/.exec(block)?.[1] ?? "");
    const date = azDate(cleanHtml(/class="doc-date">([\s\S]*?)<\/span>/.exec(block)?.[1] ?? ""));
    const number = cleanHtml(/class="doc-num">([\s\S]*?)<\/span>/.exec(block)?.[1] ?? "").replace(/^№\s*/, "");
    if (href && title && date) {
      const clean = href.replace(/&quot;/g, '"').replace(/&amp;/g, "&");
      rows.push({ date, title, url: new URL(clean, "https://nk.gov.az").toString(), ...(number ? { number } : {}), ...(type ? { type } : {}) });
    }
  }
  return rows;
}

function print(rows: Listed[], number?: string) {
  if (rows.length === 0) {
    console.log("Nothing listed on those dates.");
    return;
  }
  for (const r of rows) {
    const hit = number && r.number === number ? "★ " : "  ";
    console.log(`${hit}${r.date}  ${r.number ? `№ ${r.number}  ` : ""}${r.type ? `${r.type}  ` : ""}${r.title}\n    ${r.url}`);
  }
}

async function main() {
  if (values.register) {
    await register(values.register, values.from, values.to, Number(values.limit) || 40);
    return;
  }
  if (values.toplusu) {
    const [y, i, a] = values.toplusu.split(/\D+/).filter(Boolean).map((v) => Number.parseInt(v, 10));
    if (!(y > 1990 && i >= 1 && i <= 12 && a > 0)) fail('Give --toplusu "<year> <issue> <article>", e.g. --toplusu "2025 4 341" (or "2025, № 4, maddə 341")');
    if (values.kind && !KIND_WORD[values.kind]) fail("--kind takes decrees, orders, decisions or laws");
    await byToplusu(y, i, a, values.kind);
    return;
  }
  const dates = values.date ?? [];
  if (dates.length === 0 || dates.some((d) => !/^\d{4}-\d{2}-\d{2}$/.test(d))) fail("Give --date YYYY-MM-DD (one or more) with --president <category> or --nk");
  const days = Number(values.days) || 0;
  for (const date of dates) {
    if (values.president) {
      if (!["decrees", "orders", "laws"].includes(values.president)) fail("--president takes decrees, orders or laws");
      const rows = await findDate((n) => presidentPage(values.president!, n), 1, date, days);
      console.log(`president.az, ${values.president}, ${date}${days ? ` ±${days} day(s)` : ""}:`);
      print(rows, values.number);
    } else if (values.nk) {
      const rows = await findDate(nkPage, 0, date, days);
      console.log(`nk.gov.az, ${date}${days ? ` ±${days} day(s)` : ""}:`);
      print(rows, values.number);
    } else {
      fail("Usage: --register <text> | --toplusu <year> <issue> <article> | --president <category> --date <date> | --nk --date <date>");
    }
    console.log();
  }
}

main().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
