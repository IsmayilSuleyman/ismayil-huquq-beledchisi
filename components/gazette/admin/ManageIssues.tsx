"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/gazette/format";
import { GAZETTE_BUCKET, getBrowserSupabase, publicUrl } from "@/lib/gazette/supabase";
import type { Issue } from "@/lib/gazette/types";

export default function ManageIssues() {
  const supabase = getBrowserSupabase();
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // edit fields
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [date, setDate] = useState("");
  const [tags, setTags] = useState("");

  async function load() {
    const { data, error: err } = await supabase
      .from("issues")
      .select("*")
      .order("issue_number", { ascending: false });
    if (err) setError(err.message);
    setIssues((data as Issue[]) ?? []);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startEdit(issue: Issue) {
    setEditing(issue.id);
    setTitle(issue.title);
    setSummary(issue.summary ?? "");
    setDate(issue.published_at.slice(0, 10));
    setTags(issue.tags.join(", "));
    setError(null);
  }

  async function saveEdit(issue: Issue) {
    setBusy(issue.id);
    setError(null);
    const { error: err } = await supabase
      .from("issues")
      .update({
        title: title.trim() || issue.title,
        summary: summary.trim() || null,
        published_at: date,
        tags: [...new Set(tags.split(",").map((t) => t.trim()).filter(Boolean))].slice(0, 10),
      })
      .eq("id", issue.id);
    setBusy(null);
    if (err) {
      setError(`Save failed: ${err.message}`);
      return;
    }
    setEditing(null);
    await load();
  }

  async function removeIssue(issue: Issue) {
    if (
      !confirm(
        `Delete issue No. ${issue.issue_number} — “${issue.title}”?\n\nThis removes the PDF and all its comments permanently.`
      )
    )
      return;
    setBusy(issue.id);
    setError(null);
    const paths = [issue.pdf_path, issue.cover_path].filter(Boolean) as string[];
    const { error: storageErr } = await supabase.storage.from(GAZETTE_BUCKET).remove(paths);
    const { error: rowErr } = await supabase.from("issues").delete().eq("id", issue.id);
    setBusy(null);
    if (storageErr || rowErr) {
      setError(`Delete failed: ${(rowErr ?? storageErr)?.message}`);
      return;
    }
    await load();
  }

  if (issues === null)
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="olg-skeleton h-20 rounded-xl" />
        ))}
      </div>
    );

  if (issues.length === 0)
    return (
      <div className="olg-glass rounded-2xl p-10 text-center text-sm text-silver">
        Nothing published yet — use the <span className="text-foreground">Publish</span> tab to
        add the first weekly issue.
      </div>
    );

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-300">{error}</p>}
      {issues.map((issue) => (
        <div key={issue.id} className="olg-glass rounded-xl overflow-hidden">
          <div className="p-4 flex items-center gap-4">
            <div className="w-12 h-[3.75rem] shrink-0 rounded-md overflow-hidden bg-omni-ink border border-white/10">
              {issue.cover_path ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={publicUrl(issue.cover_path)}
                  alt=""
                  className="w-full h-full object-cover object-top"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full grid place-items-center text-[0.6rem] text-silver">
                  №{issue.issue_number}
                </div>
              )}
            </div>
            <div className="min-w-0 grow">
              <p className="text-sm font-medium truncate">
                <span className="text-silver">No. {issue.issue_number} · </span>
                {issue.title}
              </p>
              <p className="text-xs text-silver mt-0.5">
                {formatDate(issue.published_at)} · {issue.page_count ?? "?"} pages ·{" "}
                {issue.read_count.toLocaleString()} reads · {issue.download_count} downloads
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href={`/gazette/issues/${issue.issue_number}`}
                className="olg-btn olg-btn-ghost !px-3 !py-2 text-xs"
              >
                View
              </Link>
              <button
                className="olg-btn olg-btn-ghost !px-3 !py-2 text-xs"
                onClick={() => (editing === issue.id ? setEditing(null) : startEdit(issue))}
              >
                {editing === issue.id ? "Close" : "Edit"}
              </button>
              <button
                className="olg-btn olg-btn-danger !px-3 !py-2 text-xs"
                disabled={busy === issue.id}
                onClick={() => void removeIssue(issue)}
              >
                {busy === issue.id ? "…" : "Delete"}
              </button>
            </div>
          </div>

          {editing === issue.id && (
            <div className="border-t olg-hairline p-4 sm:p-5 grid sm:grid-cols-2 gap-4 bg-black/20">
              <div className="sm:col-span-2">
                <label className="block text-xs text-silver mb-1.5">Title</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className="olg-field" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-silver mb-1.5">Summary</label>
                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  rows={2}
                  maxLength={2000}
                  className="olg-field resize-y"
                />
              </div>
              <div>
                <label className="block text-xs text-silver mb-1.5">Publication date</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="olg-field [color-scheme:dark]" />
              </div>
              <div>
                <label className="block text-xs text-silver mb-1.5">Tags (comma separated)</label>
                <input value={tags} onChange={(e) => setTags(e.target.value)} className="olg-field" />
              </div>
              <div className="sm:col-span-2 flex justify-end gap-3">
                <button className="olg-btn olg-btn-ghost !py-2" onClick={() => setEditing(null)}>
                  Cancel
                </button>
                <button
                  className="olg-btn olg-btn-primary !py-2"
                  disabled={busy === issue.id}
                  onClick={() => void saveEdit(issue)}
                >
                  {busy === issue.id ? "Saving…" : "Save changes"}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
      <p className="text-[0.7rem] text-silver pt-1">
        Edits and deletions show on the public site within a minute (pages refresh every 60
        seconds).
      </p>
    </div>
  );
}
