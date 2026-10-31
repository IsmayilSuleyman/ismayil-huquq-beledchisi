"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/gazette/format";
import { describeSend } from "@/lib/gazette/push-topics";
import { kindLabel } from "@/lib/gazette/summaries";
import { GAZETTE_BUCKET, getBrowserSupabase } from "@/lib/gazette/supabase";
import type { CourtSummary } from "@/lib/gazette/types";

// The admin desk's Summaries tab: the Constitutional Court summaries the
// daily routine published, with Notify (for one whose notice failed, or to
// send it again) and Delete (for one that should not have gone out). New
// summaries come only from the routine (scripts/summaries/ROUTINE.md).

export default function SummariesDesk() {
  const supabase = getBrowserSupabase();
  const [summaries, setSummaries] = useState<CourtSummary[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // decision_id → when subscribers were notified of it
  const [sent, setSent] = useState<Record<string, string>>({});

  async function load() {
    const { data, error: err } = await supabase
      .from("court_summaries")
      .select("*")
      .order("decision_date", { ascending: false })
      .order("decision_id", { ascending: false });
    if (err) setError(err.message);
    setSummaries((data as CourtSummary[]) ?? []);
    const sends = await supabase.from("push_sends").select("ref,sent_at").eq("kind", "summary");
    setSent(Object.fromEntries((sends.data ?? []).map((r) => [r.ref as string, r.sent_at as string])));
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function notify(summary: CourtSummary) {
    const ref = String(summary.decision_id);
    const again = Boolean(sent[ref]);
    const name = `the ${kindLabel(summary.kind)} of ${formatDate(summary.decision_date)}`;
    if (
      !confirm(
        again
          ? `Subscribers were already notified of ${name} on ${formatDate(sent[ref])}. Send the notification again?`
          : `Send a notification about ${name} to everyone subscribed to court summaries?`,
      )
    )
      return;
    setBusy(summary.id);
    setError(null);
    setNotice(null);
    const { data: auth } = await supabase.auth.getSession();
    const res = await fetch("/api/gazette/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.session?.access_token ?? ""}` },
      body: JSON.stringify({ kind: "summary", ref, force: again }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(`Notify failed: ${body.error ?? res.status}`);
      return;
    }
    setNotice(`Decision ${ref}: ${describeSend(body)}.`);
    await load();
  }

  async function remove(summary: CourtSummary) {
    if (!confirm(`Delete the summary of decision ${summary.decision_id} (${formatDate(summary.decision_date)})?\n\nThis removes the Word file permanently. The routine will not publish it again on its own: it only summarises decisions that have no summary, so delete it only to keep it off the shelf.`)) return;
    setBusy(summary.id);
    setError(null);
    const { error: rowErr } = await supabase.from("court_summaries").delete().eq("id", summary.id);
    const { error: storageErr } = rowErr ? { error: null } : await supabase.storage.from(GAZETTE_BUCKET).remove([summary.docx_path]);
    setBusy(null);
    if (rowErr || storageErr) setError(`Delete failed: ${(rowErr ?? storageErr)?.message}`);
    await load();
  }

  return (
    <section className="olg-glass rounded-2xl p-6 sm:p-7">
      <h2 className="font-serif text-xl mb-1.5">Court summaries</h2>
      <p className="text-xs text-silver mb-5 leading-relaxed">
        Published every morning by the routine, one per new decision of the Plenum that passes the firm&rsquo;s
        filter; subscribers to court summaries are notified as each goes live. Delete one to take it off the
        shelf; Notify sends its notice again.
      </p>
      {error && <p className="text-sm text-red-300 mb-3">{error}</p>}
      {notice && <p className="text-sm text-emerald-300 mb-3">{notice}</p>}
      {summaries === null ? (
        <div className="olg-skeleton h-24 rounded-lg" />
      ) : summaries.length === 0 ? (
        <p className="text-sm text-silver">No summaries yet.</p>
      ) : (
        <ul className="divide-y divide-veil/[0.08]">
          {summaries.map((s) => {
            const ref = String(s.decision_id);
            return (
              <li key={s.id} className="py-3.5 flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
                <div className="min-w-0 max-w-2xl">
                  <p className="text-xs text-silver">
                    <span lang="az">{kindLabel(s.kind)}</span> · {formatDate(s.decision_date)} · No. {s.decision_id} ·{" "}
                    {s.ai_generated ? "AI-generated" : `by ${s.author}`}
                    {sent[ref] && <span className="text-emerald-300"> · notified {formatDate(sent[ref])}</span>}
                  </p>
                  <Link href={`/summaries/${s.decision_id}`} className="block mt-0.5 font-medium hover:text-azure-soft transition-colors">
                    {s.topic}
                  </Link>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    className="olg-btn olg-btn-ghost !py-1.5 !px-3 text-xs"
                    disabled={busy === s.id}
                    title={sent[ref] ? "Send the notification again" : "Send a push notification to subscribers"}
                    onClick={() => void notify(s)}
                  >
                    {sent[ref] ? "Notified ✓" : "Notify"}
                  </button>
                  <button
                    className="olg-btn olg-btn-danger !py-1.5 !px-3 text-xs"
                    disabled={busy === s.id}
                    onClick={() => void remove(s)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
