/**
 * A draft's acts as rows of `gazette_acts` (lib/gazette/acts.ts), numbered
 * in print order and classified for the board. The publisher inserts them
 * after the issue row; `gazette:acts` does the same for an issue that was
 * published without them.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { classifyAct, type ActTopic } from "@/lib/gazette/acts";
import { allEntries, type GazetteDraft } from "@/scripts/gazette/draft";

export type ActRow = {
  issue_number: number;
  position: number;
  section: "decrees" | "decisions" | "bills" | "court";
  number: string | null;
  date: string;
  text: string;
  url: string;
  stage: "I" | "II" | "III" | null;
  ruling: "qərar" | "qərardad" | null;
  topics: ActTopic[];
  important: boolean;
};

/** The rows for one issue, positions 01, 02, … as the PDF numbers them. */
export function actRows(draft: GazetteDraft, issueNumber: number): ActRow[] {
  return allEntries(draft).map(({ section, entry }, i) => {
    const { topics, important } = classifyAct({ section, text: entry.text }, entry.important);
    return {
      issue_number: issueNumber,
      position: i + 1,
      section,
      number: entry.number ?? null,
      date: entry.date,
      text: entry.text,
      url: entry.url,
      stage: entry.stage ?? null,
      ruling: entry.ruling ?? null,
      topics,
      important,
    };
  });
}

export type InsertActsResult = { status: "inserted"; count: number; important: number } | { status: "exists"; count: number };

/**
 * Inserts the issue's acts unless the issue already has some (then nothing
 * is changed: an issue's acts are replaced only by an admin, by hand). The
 * caller is signed in as the publisher or an admin.
 */
export async function insertActs(db: SupabaseClient, draft: GazetteDraft, issueNumber: number): Promise<InsertActsResult> {
  const existing = await db.from("gazette_acts").select("id", { count: "exact", head: true }).eq("issue_number", issueNumber);
  if (existing.error) throw new Error(`Could not check the acts of No. ${issueNumber}: ${existing.error.message}`);
  if ((existing.count ?? 0) > 0) return { status: "exists", count: existing.count ?? 0 };

  const rows = actRows(draft, issueNumber);
  if (rows.length === 0) return { status: "inserted", count: 0, important: 0 };
  const insert = await db.from("gazette_acts").insert(rows);
  if (insert.error) throw new Error(`Saving the acts of No. ${issueNumber} failed: ${insert.error.message}`);
  return { status: "inserted", count: rows.length, important: rows.filter((r) => r.important).length };
}
