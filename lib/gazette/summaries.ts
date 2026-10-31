import { getServerSupabase, publicUrl } from "@/lib/gazette/supabase";
import type { CourtSummary, CourtSummaryWithUrls, SummaryKind } from "@/lib/gazette/types";

// Reads for the Constitutional Court summaries (/summaries). Rows are
// public; the daily routine adds them (scripts/summaries/publish.mts) and
// admins delete from the admin desk's Summaries tab.

export function withSummaryUrls(summary: CourtSummary): CourtSummaryWithUrls {
  return { ...summary, docxUrl: publicUrl(summary.docx_path) };
}

export async function listSummaries(): Promise<CourtSummaryWithUrls[]> {
  const { data, error } = await getServerSupabase()
    .from("court_summaries")
    .select("*")
    .order("decision_date", { ascending: false })
    .order("decision_id", { ascending: false });
  if (error) {
    // Like the issues: an unreachable database renders an empty shelf, not an error page.
    console.error(`Failed to load the summaries: ${error.message}`);
    return [];
  }
  return (data as CourtSummary[]).map(withSummaryUrls);
}

export async function getSummary(decisionId: string): Promise<CourtSummaryWithUrls | null> {
  if (!/^\d{1,9}$/.test(decisionId)) return null;
  const { data } = await getServerSupabase()
    .from("court_summaries")
    .select("*")
    .eq("decision_id", Number(decisionId))
    .maybeSingle();
  return data ? withSummaryUrls(data as CourtSummary) : null;
}

/** "Qərar" / "Qərardad", the way the page and the Word file name the act. */
export function kindLabel(kind: SummaryKind): string {
  return kind === "qərar" ? "Qərar" : "Qərardad";
}

/** "Qərardad of 25 September 2026". */
export function summaryHeading(summary: Pick<CourtSummary, "kind" | "decision_date">, formatDate: (iso: string) => string): string {
  return `${kindLabel(summary.kind)} of ${formatDate(summary.decision_date)}`;
}

/** "25.09.2026", the form the Court itself uses. */
export function dottedDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}

/** Download filename: "KM Qərardad 25.09.2026 - <topic>.docx", safe for every file system. */
export function summaryFilename(summary: Pick<CourtSummary, "kind" | "decision_date" | "topic">): string {
  const topic = summary.topic
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80)
    .replace(/[\s.,;-]+$/, "");
  return `KM ${kindLabel(summary.kind)} ${dottedDate(summary.decision_date)}${topic ? ` - ${topic}` : ""}.docx`;
}
