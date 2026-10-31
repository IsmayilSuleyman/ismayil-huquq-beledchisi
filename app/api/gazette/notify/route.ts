import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { notifyNewBook, notifyNewIssue, notifyNewSummary } from "@/lib/gazette/push";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/gazette/supabase";

// The admin desk's "Notify subscribers" buttons: an issue (by number), a
// Constitutional Court summary (by decision id) or a book (by id). The
// caller's own session token does the work: row-level security lets only
// admins (and the publisher) read the push keys and subscriptions, so
// nobody else can send.
type Body = { kind?: unknown; ref?: unknown; issue_number?: unknown; force?: unknown };

export async function POST(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Body | null;
  const kind = body?.kind ?? (body?.issue_number !== undefined ? "issue" : undefined);
  const ref = String(body?.ref ?? body?.issue_number ?? "");
  const force = body?.force === true;

  const db = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const expired = () => NextResponse.json({ error: "Your sign-in has expired; sign in again." }, { status: 401 });
  const missing = (what: string) => NextResponse.json({ error: `No such ${what}.` }, { status: 404 });

  try {
    if (kind === "issue") {
      const n = Number(ref);
      if (!Number.isInteger(n) || n <= 0) return NextResponse.json({ error: "Which issue?" }, { status: 400 });
      const issue = await db.from("issues").select("issue_number,title").eq("issue_number", n).maybeSingle();
      if (issue.error) return expired();
      if (!issue.data) return missing("issue");
      return NextResponse.json(await notifyNewIssue(db, issue.data, { force }));
    }
    if (kind === "summary") {
      const n = Number(ref);
      if (!Number.isInteger(n) || n <= 0) return NextResponse.json({ error: "Which summary?" }, { status: 400 });
      const summary = await db
        .from("court_summaries")
        .select("decision_id,kind,decision_date,topic")
        .eq("decision_id", n)
        .maybeSingle();
      if (summary.error) return expired();
      if (!summary.data) return missing("summary");
      return NextResponse.json(await notifyNewSummary(db, summary.data, { force }));
    }
    if (kind === "book") {
      if (!/^[0-9a-f-]{36}$/i.test(ref)) return NextResponse.json({ error: "Which book?" }, { status: 400 });
      const book = await db.from("books").select("id,title,author").eq("id", ref).maybeSingle();
      if (book.error) return expired();
      if (!book.data) return missing("book");
      return NextResponse.json(await notifyNewBook(db, book.data, { force }));
    }
    return NextResponse.json({ error: "Notify about what? kind must be issue, summary or book." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }
}
