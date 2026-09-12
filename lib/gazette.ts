import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/supabase/config";

/**
 * Omni Law Gazette — the weekly legislation digest — is a separate app
 * mounted under /gazette (proxied by next.config) and sharing this
 * Supabase project. The guide only reads its `issues` table for the
 * landing page and links across; publishing, reading and discussion happen
 * in the gazette app.
 */

export const GAZETTE_BUCKET = "gazette";

/** Where the gazette is mounted; same domain by default (see next.config rewrites). */
export const GAZETTE_URL = (process.env.NEXT_PUBLIC_GAZETTE_URL ?? "/gazette").replace(/\/$/, "");

/** Reading-room URL of an issue on the gazette site. */
export function issueUrl(issueNumber: number): string {
  return `${GAZETTE_URL}/issues/${issueNumber}`;
}

export type Issue = {
  id: string;
  issue_number: number;
  title: string;
  summary: string | null;
  published_at: string; // ISO date
  tags: string[];
  pdf_path: string;
  cover_path: string | null;
  page_count: number | null;
  file_size_bytes: number | null;
  read_count: number;
  download_count: number;
  created_at: string;
  updated_at: string;
};

export type IssueComment = {
  id: string;
  issue_id: string;
  author_name: string;
  body: string;
  created_at: string;
};

export type IssueWithUrls = Issue & { coverUrl: string | null; pdfUrl: string };

/** Public CDN URL for an object in the gazette bucket. */
export function publicUrl(path: string): string {
  const config = getSupabaseConfig();
  const base = config?.url ?? "";
  return `${base}/storage/v1/object/public/${GAZETTE_BUCKET}/${path}`;
}

export function withUrls(issue: Issue): IssueWithUrls {
  return {
    ...issue,
    coverUrl: issue.cover_path ? publicUrl(issue.cover_path) : null,
    pdfUrl: publicUrl(issue.pdf_path),
  };
}

let anon: SupabaseClient | null = null;

/** Session-less client for public reads (issues and comments are world-readable). */
function anonClient(): SupabaseClient | null {
  if (anon) return anon;
  const config = getSupabaseConfig();
  if (!config) return null;
  anon = createClient(config.url, config.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return anon;
}

export async function listIssues(): Promise<IssueWithUrls[]> {
  const supabase = anonClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("issues")
    .select("*")
    .order("issue_number", { ascending: false });
  if (error) {
    console.error("issues read failed:", error);
    return [];
  }
  return ((data ?? []) as Issue[]).map(withUrls);
}

export async function getIssue(numberParam: string): Promise<IssueWithUrls | null> {
  const issueNumber = Number(numberParam);
  if (!Number.isInteger(issueNumber) || issueNumber <= 0) return null;
  const supabase = anonClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("issues")
    .select("*")
    .eq("issue_number", issueNumber)
    .maybeSingle();
  if (error) {
    console.error("issue read failed:", error);
    return null;
  }
  return data ? withUrls(data as Issue) : null;
}

export type IssueRef = Pick<Issue, "issue_number" | "title">;

export async function getNeighbors(
  issueNumber: number,
): Promise<{ prev: IssueRef | null; next: IssueRef | null }> {
  const supabase = anonClient();
  if (!supabase) return { prev: null, next: null };
  const [prev, next] = await Promise.all([
    supabase
      .from("issues")
      .select("issue_number,title")
      .lt("issue_number", issueNumber)
      .order("issue_number", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("issues")
      .select("issue_number,title")
      .gt("issue_number", issueNumber)
      .order("issue_number", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);
  return {
    prev: (prev.data as IssueRef | null) ?? null,
    next: (next.data as IssueRef | null) ?? null,
  };
}
