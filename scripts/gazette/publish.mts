#!/usr/bin/env node
/**
 * Omni Law Gazette — automated publisher.
 *
 * Takes an issue draft (JSON, format in ./draft.ts), checks it, numbers it
 * after the latest issue, renders the PDF and its cover, uploads both to
 * the `gazette` bucket and inserts the `issues` row: the same result as the
 * publish form in /gazette/admin, with no browser.
 *
 * Usage:
 *   npm run gazette:publish -- <draft.json> --dry-run [--out <dir>]
 *   npm run gazette:publish -- <draft.json>
 *
 * --dry-run renders the PDF and cover into --out (default: the draft's
 * folder) and prints the row it would insert; it needs no credentials.
 * Publishing signs in as the publisher account (see the migration
 * supabase/migrations/20261030120000_gazette_publisher.sql) with
 * GAZETTE_PUBLISHER_EMAIL and GAZETTE_PUBLISHER_PASSWORD.
 *
 * Exit codes: 0 published (or already published), 1 failed, 2 bad draft.
 */

import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { GAZETTE_BUCKET, SUPABASE_KEY, SUPABASE_URL, publicUrl } from "@/lib/gazette/supabase";
import { analyzePdfBuffer } from "@/scripts/gazette/cover";
import { checkDraft, issueTitle, type GazetteDraft } from "@/scripts/gazette/draft";
import { renderIssuePdf } from "@/scripts/gazette/issue-pdf";

const SITE = "https://ismayilhuquqbeledchisi.vercel.app";
const MAX_PDF_BYTES = 50 * 1024 * 1024;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    "dry-run": { type: "boolean", default: false },
    out: { type: "string" },
  },
});

function fail(message: string, code = 1): never {
  console.error(`\n✗ ${message}\n`);
  process.exit(code);
}

type Existing = { issue_number: number; title: string; published_at: string };

/** Latest issue number, and any issue already covering this period or date. */
async function lookUp(db: SupabaseClient, draft: GazetteDraft, title: string) {
  const latest = await db
    .from("issues")
    .select("issue_number")
    .order("issue_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latest.error) throw new Error(`Could not read the latest issue: ${latest.error.message}`);

  const clash = await db
    .from("issues")
    .select("issue_number,title,published_at")
    .or(`title.eq."${title.replace(/"/g, '\\"')}",published_at.eq.${draft.published_at}`)
    .limit(1)
    .maybeSingle<Existing>();
  if (clash.error) throw new Error(`Could not check for an existing issue: ${clash.error.message}`);

  return { next: ((latest.data?.issue_number as number | undefined) ?? 0) + 1, clash: clash.data };
}

async function main() {
  const draftPath = positionals[0];
  if (!draftPath) fail("Usage: npm run gazette:publish -- <draft.json> [--dry-run] [--out <dir>]", 2);
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
  const title = issueTitle(draft);
  console.log(`\n📰 ${title}`);

  const db = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  let issueNumber: number;
  try {
    const { next, clash } = await lookUp(db, draft, title);
    if (clash) {
      console.log(
        `\n✓ Already published as No. ${clash.issue_number} ("${clash.title}", ${clash.published_at}). Nothing to do.\n`
      );
      return;
    }
    issueNumber = next;
  } catch (e) {
    if (!dryRun) fail((e as Error).message);
    console.warn(`  ! ${(e as Error).message}; numbering the dry run 0`);
    issueNumber = 0;
  }

  console.log(`   Rendering No. ${issueNumber} …`);
  const pdf = await renderIssuePdf(draft, issueNumber);
  if (pdf.byteLength > MAX_PDF_BYTES) fail(`The PDF is ${pdf.byteLength} bytes; the bucket limit is 50 MB`);
  const { pageCount, cover } = await analyzePdfBuffer(pdf);
  console.log(`   ${pageCount} page(s), ${Math.round(pdf.byteLength / 1024)} KB, cover ${Math.round(cover.byteLength / 1024)} KB`);

  const row = {
    issue_number: issueNumber,
    title,
    summary: draft.summary,
    published_at: draft.published_at,
    tags: draft.tags,
    page_count: pageCount,
    file_size_bytes: pdf.byteLength,
  };

  if (dryRun) {
    const outDir = resolve(values.out ?? dirname(draftPath));
    mkdirSync(outDir, { recursive: true });
    const pdfFile = join(outDir, `issue-${issueNumber}.pdf`);
    const coverFile = join(outDir, `issue-${issueNumber}-cover.webp`);
    writeFileSync(pdfFile, pdf);
    writeFileSync(coverFile, cover);
    console.log(`\n✓ Dry run. Nothing was uploaded.\n   PDF   ${pdfFile}\n   Cover ${coverFile}\n   Row   ${JSON.stringify(row)}\n`);
    return;
  }

  const email = process.env.GAZETTE_PUBLISHER_EMAIL?.trim();
  const password = process.env.GAZETTE_PUBLISHER_PASSWORD;
  if (!email || !password) fail("Set GAZETTE_PUBLISHER_EMAIL and GAZETTE_PUBLISHER_PASSWORD to publish");

  const signIn = await db.auth.signInWithPassword({ email, password });
  if (signIn.error) fail(`Publisher sign-in failed: ${signIn.error.message}`);

  // Same layout as the admin form: pdfs/ and covers/, a random suffix per upload.
  const rand = randomUUID().slice(0, 8);
  const pdfPath = `pdfs/issue-${issueNumber}-${rand}.pdf`;
  const coverPath = `covers/issue-${issueNumber}-${rand}.webp`;
  const storage = db.storage.from(GAZETTE_BUCKET);
  const uploaded: string[] = [];

  try {
    const up1 = await storage.upload(pdfPath, pdf, { contentType: "application/pdf", cacheControl: "31536000" });
    if (up1.error) throw new Error(`PDF upload failed: ${up1.error.message}`);
    uploaded.push(pdfPath);

    const up2 = await storage.upload(coverPath, cover, { contentType: "image/webp", cacheControl: "31536000" });
    if (up2.error) throw new Error(`Cover upload failed: ${up2.error.message}`);
    uploaded.push(coverPath);

    const insert = await db.from("issues").insert({ ...row, pdf_path: pdfPath, cover_path: coverPath });
    if (insert.error) {
      throw new Error(
        insert.error.code === "23505"
          ? `Issue number ${issueNumber} was taken while this run was rendering; run it again`
          : `Saving the issue failed: ${insert.error.message}`
      );
    }
  } catch (e) {
    if (uploaded.length > 0) {
      const removed = await storage.remove(uploaded);
      if (removed.error) console.error(`  ! Could not remove ${uploaded.join(", ")}: ${removed.error.message}`);
    }
    await db.auth.signOut();
    fail((e as Error).message);
  }

  await db.auth.signOut();

  // The row is live; make sure readers can actually open the file.
  const check = await fetch(publicUrl(pdfPath), { method: "HEAD" });
  if (!check.ok) console.warn(`  ! The PDF answered ${check.status} at ${publicUrl(pdfPath)}`);

  console.log(`\n✓ Published No. ${issueNumber}\n   ${SITE}/gazette/issues/${issueNumber}\n`);
}

main().catch((e) => fail(e instanceof Error ? (e.stack ?? e.message) : String(e)));
