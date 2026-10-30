#!/usr/bin/env node
/**
 * Stores an issue's acts in `gazette_acts` from its draft, for an issue
 * that was published without them (an older issue, or a run where the
 * publisher's acts step failed). The issue is found by the draft's title;
 * an issue that already has acts is left alone.
 *
 * Usage:
 *   npm run gazette:acts -- <draft.json> [<draft.json> …] [--dry-run]
 *
 * --dry-run prints the rows and their classification without signing in.
 * Otherwise it signs in as the publisher (GAZETTE_PUBLISHER_EMAIL and
 * GAZETTE_PUBLISHER_PASSWORD), as gazette:publish does.
 *
 * Exit codes: 0 done, 1 failed, 2 bad draft or usage.
 */

import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/gazette/supabase";
import { actRows, insertActs } from "@/scripts/gazette/acts";
import { checkDraft, issueTitle, type GazetteDraft } from "@/scripts/gazette/draft";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { "dry-run": { type: "boolean", default: false } },
});

function fail(message: string, code = 1): never {
  console.error(`\n✗ ${message}\n`);
  process.exit(code);
}

function readDraft(path: string): GazetteDraft {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    fail(`Could not read ${path} as JSON: ${(e as Error).message}`, 2);
  }
  const checked = checkDraft(raw);
  if (!checked.ok) fail(`${path} has ${checked.errors.length} problem(s):\n${checked.errors.map((e) => `  - ${e}`).join("\n")}`, 2);
  return checked.draft;
}

async function main() {
  if (positionals.length === 0) fail("Usage: npm run gazette:acts -- <draft.json> [<draft.json> …] [--dry-run]", 2);
  const drafts = positionals.map((path) => ({ path, draft: readDraft(path) }));

  const db = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  if (!values["dry-run"]) {
    const email = process.env.GAZETTE_PUBLISHER_EMAIL?.trim();
    const password = process.env.GAZETTE_PUBLISHER_PASSWORD;
    if (!email || !password) fail("Set GAZETTE_PUBLISHER_EMAIL and GAZETTE_PUBLISHER_PASSWORD, or use --dry-run");
    const signIn = await db.auth.signInWithPassword({ email, password });
    if (signIn.error) fail(`Publisher sign-in failed: ${signIn.error.message}`);
  }

  try {
    for (const { path, draft } of drafts) {
      const title = issueTitle(draft);
      const found = await db.from("issues").select("issue_number").eq("title", title).maybeSingle<{ issue_number: number }>();
      if (found.error) throw new Error(`Could not look up "${title}": ${found.error.message}`);
      if (!found.data) {
        console.warn(`  ! ${path}: "${title}" is not published; publish it first`);
        continue;
      }
      const issueNumber = found.data.issue_number;

      if (values["dry-run"]) {
        const rows = actRows(draft, issueNumber);
        console.log(`\n📰 No. ${issueNumber} — ${title}: ${rows.length} act(s), ${rows.filter((r) => r.important).length} on the board`);
        for (const r of rows) {
          const mark = r.important ? "★" : " ";
          const tags = r.topics.length ? ` [${r.topics.join(", ")}]` : "";
          console.log(`  ${mark} ${String(r.position).padStart(2, "0")} ${r.section}${r.number ? ` № ${r.number}` : ""}${tags}: ${r.text.slice(0, 90)}…`);
        }
        continue;
      }

      const result = await insertActs(db, draft, issueNumber);
      if (result.status === "inserted") console.log(`✓ No. ${issueNumber}: stored ${result.count} act(s), ${result.important} on the board`);
      else console.log(`· No. ${issueNumber} already has ${result.count} act(s); nothing changed`);
    }
  } finally {
    if (!values["dry-run"]) await db.auth.signOut();
  }
}

main().catch((e) => fail(e instanceof Error ? (e.stack ?? e.message) : String(e)));
