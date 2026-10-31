#!/usr/bin/env node
/**
 * Constitutional Court summaries — automated publisher.
 *
 * Takes a summary draft (JSON, format in ./draft.ts), checks it against
 * the method, lays it out as the Word file (./docx.ts), uploads the file to
 * the `gazette` bucket under summaries/ and inserts the `court_summaries`
 * row the page renders; then tells the browsers subscribed to court
 * summaries (lib/gazette/push.ts).
 *
 * Usage:
 *   npm run summaries:publish -- <draft.json> --dry-run [--out <dir>]
 *   npm run summaries:publish -- <draft.json> [--no-notify]
 *
 * --dry-run writes the Word file into --out (default: the draft's folder)
 * and prints the row it would insert; it needs no credentials. Publishing
 * signs in as the publisher account (the same one the gazette uses:
 * supabase/migrations/20261030120000_gazette_publisher.sql) with
 * GAZETTE_PUBLISHER_EMAIL and GAZETTE_PUBLISHER_PASSWORD.
 *
 * A decision that already has a summary is left alone (exit 0). A failed
 * notice is a warning: the summary stays published and an admin can press
 * Notify in the admin desk.
 *
 * Exit codes: 0 published (or already was), 1 failed, 2 bad draft.
 */

import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { describeSend, notifyNewSummary } from "@/lib/gazette/push";
import { summaryFilename } from "@/lib/gazette/summaries";
import { GAZETTE_BUCKET, SUPABASE_KEY, SUPABASE_URL, publicUrl } from "@/lib/gazette/supabase";
import { allBullets, checkDraft, quotedWords } from "@/scripts/summaries/draft";
import { renderSummaryDocx } from "@/scripts/summaries/docx";

const SITE = "https://omnilawgazette.vercel.app";
const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    "dry-run": { type: "boolean", default: false },
    "no-notify": { type: "boolean", default: false },
    out: { type: "string" },
  },
});

function fail(message: string, code = 1): never {
  console.error(`\n✗ ${message}\n`);
  process.exit(code);
}

async function main() {
  const draftPath = positionals[0];
  if (!draftPath) fail("Usage: npm run summaries:publish -- <draft.json> [--dry-run] [--out <dir>] [--no-notify]", 2);
  const dryRun = values["dry-run"] ?? false;

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(draftPath, "utf8"));
  } catch (e) {
    fail(`Could not read ${draftPath} as JSON: ${(e as Error).message}`, 2);
  }

  const checked = checkDraft(raw);
  for (const warning of checked.warnings) console.warn(`  ! ${warning}`);
  if (!checked.ok) {
    fail(`The draft has ${checked.errors.length} problem(s):\n${checked.errors.map((e) => `  - ${e}`).join("\n")}`, 2);
  }
  const draft = checked.draft;
  console.log(`\n⚖  ${draft.kind === "qərar" ? "Qərar" : "Qərardad"} ${draft.decision_date} · decision ${draft.decision_id}`);
  console.log(`   Topic: ${draft.topic}`);
  console.log(`   ${allBullets(draft.blocks).length} bullet(s), ${quotedWords(draft.blocks)} words quoted`);

  const db = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  try {
    const existing = await db
      .from("court_summaries")
      .select("decision_id,published_at")
      .eq("decision_id", draft.decision_id)
      .maybeSingle();
    if (existing.error) throw new Error(`Could not check for an existing summary: ${existing.error.message}`);
    if (existing.data) {
      console.log(`\n✓ Decision ${draft.decision_id} already has a summary (published ${existing.data.published_at.slice(0, 10)}). Nothing to do.\n`);
      return;
    }
  } catch (e) {
    if (!dryRun) fail((e as Error).message);
    console.warn(`  ! ${(e as Error).message}`);
  }

  console.log("   Rendering the Word file …");
  const docx = await renderSummaryDocx(draft, { site: SITE });
  console.log(`   ${Math.round(docx.byteLength / 1024)} KB`);

  const row = {
    decision_id: draft.decision_id,
    decision_date: draft.decision_date,
    kind: draft.kind,
    title: draft.title,
    topic: draft.topic,
    url: draft.url,
    body: draft.blocks,
    file_size_bytes: docx.byteLength,
  };

  if (dryRun) {
    const outDir = resolve(values.out ?? dirname(draftPath));
    mkdirSync(outDir, { recursive: true });
    const file = join(outDir, summaryFilename(draft));
    writeFileSync(file, docx);
    const shown = { ...row, body: `[${draft.blocks.length} block(s)]` };
    console.log(`\n✓ Dry run. Nothing was uploaded.\n   Word  ${file}\n   Row   ${JSON.stringify(shown)}\n`);
    return;
  }

  const email = process.env.GAZETTE_PUBLISHER_EMAIL?.trim();
  const password = process.env.GAZETTE_PUBLISHER_PASSWORD;
  if (!email || !password) fail("Set GAZETTE_PUBLISHER_EMAIL and GAZETTE_PUBLISHER_PASSWORD to publish");

  const signIn = await db.auth.signInWithPassword({ email, password });
  if (signIn.error) fail(`Publisher sign-in failed: ${signIn.error.message}`);

  const docxPath = `summaries/km-${draft.decision_id}-${randomUUID().slice(0, 8)}.docx`;
  const storage = db.storage.from(GAZETTE_BUCKET);

  try {
    const up = await storage.upload(docxPath, docx, { contentType: DOCX_TYPE, cacheControl: "31536000" });
    if (up.error) throw new Error(`Word upload failed: ${up.error.message}`);

    const insert = await db.from("court_summaries").insert({ ...row, docx_path: docxPath });
    if (insert.error) {
      const removed = await storage.remove([docxPath]);
      if (removed.error) console.error(`  ! Could not remove ${docxPath}: ${removed.error.message}`);
      throw new Error(
        insert.error.code === "23505"
          ? `Decision ${draft.decision_id} was summarised while this run was rendering; nothing more to do`
          : `Saving the summary failed: ${insert.error.message}`,
      );
    }
  } catch (e) {
    await db.auth.signOut();
    fail((e as Error).message);
  }

  // The summary is live whatever happens from here on.
  if (values["no-notify"]) console.log("   Subscribers not notified (--no-notify)");
  else {
    try {
      const sent = await notifyNewSummary(db, draft);
      console.log(`   ${sent.status === "sent" ? "N" : "Already n"}otified: ${describeSend(sent)}`);
    } catch (e) {
      console.warn(`  ! Subscribers were not notified (press Notify in the admin desk): ${(e as Error).message}`);
    }
  }

  await db.auth.signOut();

  const check = await fetch(publicUrl(docxPath), { method: "HEAD" });
  if (!check.ok) console.warn(`  ! The Word file answered ${check.status} at ${publicUrl(docxPath)}`);

  console.log(`\n✓ Published the summary of decision ${draft.decision_id}\n   ${SITE}/summaries/${draft.decision_id}\n`);
}

main().catch((e) => fail(e instanceof Error ? (e.stack ?? e.message) : String(e)));
