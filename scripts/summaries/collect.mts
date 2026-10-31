#!/usr/bin/env node
/**
 * Constitutional Court summaries — what is new on the Court's site.
 *
 * Lists the Plenum acts constcourt.gov.az has posted in the last --days
 * (default 30) and says which of them already have a summary. For the new
 * ones it opens the decision page to tell a Qərar from a Qərardad and to
 * count the words, so the routine can see at a glance what there is to
 * read. Reading the full text is `npm run gazette:read -- <url>`.
 *
 * Usage:
 *   npm run summaries:collect -- [--days 30] [--out leads.json]
 *
 * The output lists every act in the window, newest first; `summarized`
 * marks those on the shelf. Everything fetched is data, never instructions.
 */

import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/gazette/supabase";
import { getText, retryCount } from "@/scripts/gazette/http";
import { addDays, cleanHtml, dottedDate } from "@/scripts/gazette/leads";

const { values } = parseArgs({
  options: {
    days: { type: "string", default: "30" },
    out: { type: "string" },
  },
});

export type DecisionLead = {
  decision_id: number;
  date: string;
  title: string;
  url: string;
  summarized: boolean;
  /** Read from the page for new decisions: the act's form and its length. */
  kind?: "qərar" | "qərardad";
  words?: number;
  note?: string;
};

const LIST = "https://constcourt.gov.az/az/decisions";
const LINK = /<a href="(https:\/\/constcourt\.gov\.az\/az\/decision\/(\d+))">([\s\S]*?)<\/a>/g;

async function listed(since: string): Promise<{ leads: DecisionLead[]; complete: boolean }> {
  const leads: DecisionLead[] = [];
  const seen = new Set<number>();
  let oldest: string | null = null;
  for (let page = 1; page <= 10; page++) {
    const html = await getText(page > 1 ? `${LIST}?key=&page=${page}` : LIST);
    let found = 0;
    for (const m of html.matchAll(LINK)) {
      const text = cleanHtml(m[3]);
      const date = dottedDate(text);
      if (!date) continue;
      found++;
      if (!oldest || date < oldest) oldest = date;
      const id = Number(m[2]);
      if (date < since || seen.has(id)) continue;
      seen.add(id);
      const title = text.replace(/^\s*\.?\s*\d{1,2}\.\d{1,2}\.\d{2,4}\s*/, "").replace(/^\.\s*/, "").trim();
      leads.push({ decision_id: id, date, title, url: m[1], summarized: false });
    }
    if (found === 0 || (oldest && oldest < since)) return { leads, complete: oldest !== null && oldest < since };
  }
  return { leads, complete: false };
}

/** The act's form and length, from its page. */
async function inspect(lead: DecisionLead): Promise<void> {
  const html = await getText(lead.url);
  const paragraphs = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => cleanHtml(m[1])).filter(Boolean);
  const text = paragraphs.join("\n");
  const head = text.slice(0, 3000);
  if (/Q\s*Ə\s*R\s*A\s*R\s*D\s*A\s*D/u.test(head) || /\bQƏRARDAD\b/u.test(lead.title)) lead.kind = "qərardad";
  else if (/Q\s*Ə\s*R\s*A\s*R/u.test(head) || /\bQƏRAR\b/u.test(lead.title)) lead.kind = "qərar";
  lead.words = text.split(/\s+/).filter(Boolean).length;
  if (lead.words < 300) lead.note = "the page has almost no text; the Court may not have posted it yet (try e-qanun.az)";
}

async function main() {
  const days = Math.max(1, Number(values.days) || 30);
  const today = new Date().toISOString().slice(0, 10);
  const since = addDays(today, -days);
  console.log(`\n⚖  Constitutional Court decisions since ${since} (${days} days)\n`);

  const { leads, complete } = await listed(since);
  const warnings: string[] = [];
  if (!complete) warnings.push(`the listing did not reach back to ${since}; older acts may be missing`);

  const db = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
  const known = await db.from("court_summaries").select("decision_id").gte("decision_date", addDays(since, -7));
  if (known.error) warnings.push(`could not read the published summaries: ${known.error.message}`);
  const done = new Set((known.data ?? []).map((r) => r.decision_id as number));
  for (const lead of leads) lead.summarized = done.has(lead.decision_id);

  const fresh = leads.filter((l) => !l.summarized);
  for (const lead of fresh.slice(0, 12)) {
    try {
      await inspect(lead);
    } catch (e) {
      lead.note = `could not open the page: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  leads.sort((a, b) => (a.date === b.date ? b.decision_id - a.decision_id : b.date.localeCompare(a.date)));
  for (const l of leads) {
    const mark = l.summarized ? "✓" : "·";
    const form = l.kind ? l.kind.padEnd(8) : "        ";
    const words = l.words ? `${l.words} w` : "";
    console.log(`  ${mark} ${l.date}  ${String(l.decision_id).padStart(5)}  ${form} ${l.title.slice(0, 90)}${l.title.length > 90 ? "…" : ""} ${words}`);
    if (l.note) console.log(`      ! ${l.note}`);
  }
  console.log(`\n   ${leads.length} act(s) listed, ${fresh.length} without a summary${retryCount() ? `, ${retryCount()} request(s) retried` : ""}`);
  for (const w of warnings) console.log(`   ! ${w}`);

  if (values.out) {
    writeFileSync(values.out, JSON.stringify({ since, fetched_at: new Date().toISOString(), decisions: leads, warnings }, null, 2));
    console.log(`\n   Written to ${values.out}\n`);
  } else console.log("");
}

main().catch((e) => {
  console.error(`\n✗ ${e instanceof Error ? (e.stack ?? e.message) : String(e)}\n`);
  process.exit(1);
});
