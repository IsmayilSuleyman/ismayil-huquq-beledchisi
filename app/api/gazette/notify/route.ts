import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { notifyNewIssue } from "@/lib/gazette/push";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/gazette/supabase";

// The admin desk's "Notify subscribers" button. The caller's own session
// token does the work: row-level security lets only admins (and the
// publisher) read the push keys and subscriptions, so nobody else can send.
export async function POST(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { issue_number?: unknown; force?: unknown } | null;
  const issueNumber = Number(body?.issue_number);
  if (!Number.isInteger(issueNumber) || issueNumber <= 0) {
    return NextResponse.json({ error: "Which issue?" }, { status: 400 });
  }

  const db = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const issue = await db.from("issues").select("issue_number,title").eq("issue_number", issueNumber).maybeSingle();
  if (issue.error) return NextResponse.json({ error: "Your sign-in has expired; sign in again." }, { status: 401 });
  if (!issue.data) return NextResponse.json({ error: "No such issue." }, { status: 404 });

  try {
    const result = await notifyNewIssue(db, issue.data, { force: body?.force === true });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }
}
