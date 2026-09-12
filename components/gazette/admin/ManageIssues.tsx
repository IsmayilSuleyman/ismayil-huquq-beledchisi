"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GAZETTE_BUCKET, publicUrl, type Issue } from "@/lib/gazette";
import { formatDate } from "@/lib/gazette-format";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function ManageIssues() {
  const supabase = createSupabaseBrowserClient();
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
    if (!supabase) {
      setIssues([]);
      return;
    }
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
    if (!supabase) return;
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
      setError(`Yadda saxlanılmadı: ${err.message}`);
      return;
    }
    setEditing(null);
    await load();
  }

  async function removeIssue(issue: Issue) {
    if (!supabase) return;
    if (
      !confirm(
        `${issue.issue_number} nömrəli buraxılış silinsin — "${issue.title}"?\n\nPDF və bütün şərhlər birdəfəlik silinəcək.`,
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
      setError(`Silinmədi: ${(rowErr ?? storageErr)?.message}`);
      return;
    }
    await load();
  }

  if (issues === null)
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-20 rounded-xl" />
        ))}
      </div>
    );

  if (issues.length === 0)
    return (
      <div className="glass p-10 text-center text-sm text-ink/55 dark:text-white/55">
        Hələ heç nə nəşr olunmayıb — ilk buraxılışı{" "}
        <span className="text-ink dark:text-white">Nəşr et</span> bölməsindən əlavə edin.
      </div>
    );

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-brand-red dark:text-red-300">{error}</p>}
      {issues.map((issue) => (
        <div key={issue.id} className="glass overflow-hidden">
          <div className="flex items-center gap-4 p-4">
            <div className="h-[3.75rem] w-12 shrink-0 overflow-hidden rounded-md border border-ink/10 bg-brand-cream-deep dark:border-white/10 dark:bg-black/40">
              {issue.cover_path ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={publicUrl(issue.cover_path)}
                  alt=""
                  className="h-full w-full object-cover object-top"
                  loading="lazy"
                />
              ) : (
                <div className="grid h-full w-full place-items-center text-[0.6rem] text-ink/45 dark:text-white/45">
                  №{issue.issue_number}
                </div>
              )}
            </div>
            <div className="min-w-0 grow">
              <p className="truncate text-sm font-medium text-ink dark:text-white/90">
                <span className="text-ink/45 dark:text-white/45">№ {issue.issue_number} · </span>
                {issue.title}
              </p>
              <p className="num mt-0.5 text-xs text-ink/45 dark:text-white/45">
                {formatDate(issue.published_at)} · {issue.page_count ?? "?"} səhifə ·{" "}
                {issue.read_count.toLocaleString("az-AZ")} oxunma · {issue.download_count} yükləmə
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Link href={`/gazette/${issue.issue_number}`} className="btn btn-ghost !px-3 !py-2 text-xs">
                Bax
              </Link>
              <button
                type="button"
                className="btn btn-ghost !px-3 !py-2 text-xs"
                onClick={() => (editing === issue.id ? setEditing(null) : startEdit(issue))}
              >
                {editing === issue.id ? "Bağla" : "Redaktə"}
              </button>
              <button
                type="button"
                className="btn btn-danger !px-3 !py-2 text-xs"
                disabled={busy === issue.id}
                onClick={() => void removeIssue(issue)}
              >
                {busy === issue.id ? "…" : "Sil"}
              </button>
            </div>
          </div>

          {editing === issue.id && (
            <div className="grid gap-4 border-t border-brand-wood-ring/70 bg-white/30 p-4 dark:border-white/10 dark:bg-black/20 sm:grid-cols-2 sm:p-5">
              <div className="sm:col-span-2">
                <label className="label">Başlıq</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className="field" />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Xülasə</label>
                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  rows={2}
                  maxLength={2000}
                  className="field resize-y"
                />
              </div>
              <div>
                <label className="label">Nəşr tarixi</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field" />
              </div>
              <div>
                <label className="label">Teqlər (vergüllə)</label>
                <input value={tags} onChange={(e) => setTags(e.target.value)} className="field" />
              </div>
              <div className="flex justify-end gap-3 sm:col-span-2">
                <button type="button" className="btn btn-ghost !py-2" onClick={() => setEditing(null)}>
                  Ləğv et
                </button>
                <button
                  type="button"
                  className="btn btn-primary !py-2"
                  disabled={busy === issue.id}
                  onClick={() => void saveEdit(issue)}
                >
                  {busy === issue.id ? "Yadda saxlanılır…" : "Yadda saxla"}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
