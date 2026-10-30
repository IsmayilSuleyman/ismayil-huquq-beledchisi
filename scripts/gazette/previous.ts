/**
 * What the last few issues already printed, so an act is not reported
 * twice: the collector marks such leads, and the publisher warns before an
 * issue repeats one. Issues are compared by their PDF text, which carries
 * each act's number ("№ 261", "No. 261" in the early English issues) and,
 * for most entries, its e-qanun.az link with the register id.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { publicUrl } from "@/lib/gazette/supabase";
import { pdfText } from "@/scripts/gazette/pdf-text";

export type PastIssue = { issueNumber: number; text: string };

/** The latest issues' text, newest first. Unreadable PDFs are skipped. */
export async function recentIssues(db: SupabaseClient, count = 3): Promise<PastIssue[]> {
  const { data, error } = await db
    .from("issues")
    .select("issue_number,pdf_path")
    .order("issue_number", { ascending: false })
    .limit(count);
  if (error) throw new Error(`Could not read the latest issues: ${error.message}`);
  const issues: PastIssue[] = [];
  for (const row of (data ?? []) as { issue_number: number; pdf_path: string }[]) {
    try {
      const res = await fetch(publicUrl(row.pdf_path), { signal: AbortSignal.timeout(45_000) });
      if (!res.ok) continue;
      issues.push({ issueNumber: row.issue_number, text: await pdfText(new Uint8Array(await res.arrayBuffer())) });
    } catch {
      // A missing or broken PDF only weakens the check; it never blocks a run.
    }
  }
  return issues;
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The first of these issues that printed the act's number or register id, if any. */
export function printedIn(act: { number?: string; url?: string }, issues: PastIssue[]): number | null {
  const id = act.url ? /e-qanun\.az\/framework\/(\d+)/.exec(act.url)?.[1] : undefined;
  const byNumber = act.number ? new RegExp(`(№|No\\.?)\\s*${escape(act.number.replace(/^№\s*/, ""))}(?![\\w-])`, "iu") : null;
  const byId = id ? new RegExp(`framework/${id}(?!\\d)`) : null;
  for (const issue of issues) {
    if ((byNumber && byNumber.test(issue.text)) || (byId && byId.test(issue.text))) return issue.issueNumber;
  }
  return null;
}
