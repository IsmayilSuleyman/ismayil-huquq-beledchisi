"use client";

import { useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { timeAgo } from "@/lib/gazette-format";
import type { IssueComment } from "@/lib/gazette";

const NAME_KEY = "ihb-commenter-name";

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function hueOf(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

/**
 * Open discussion under an issue. Anyone can post with a name (the table's
 * insert policy is open); signed-in people get their Google name prefilled.
 * Deletion is offered only to editors and enforced by the delete policy.
 */
export function Comments({
  issueId,
  defaultName = "",
  canModerate = false,
}: {
  issueId: string;
  defaultName?: string;
  canModerate?: boolean;
}) {
  const supabase = createSupabaseBrowserClient();
  const [comments, setComments] = useState<IssueComment[] | null>(null);
  const [name, setName] = useState(defaultName);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const honeypot = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(NAME_KEY);
      if (stored && !defaultName) setName(stored);
    } catch {
      // storage unavailable — the field simply starts empty
    }
    if (!supabase) {
      setComments([]);
      return;
    }
    void supabase
      .from("comments")
      .select("*")
      .eq("issue_id", issueId)
      .order("created_at", { ascending: true })
      .then(({ data, error: err }) => {
        if (err) setError("Şərhlər yüklənmədi. Səhifəni yeniləyin.");
        setComments((data as IssueComment[]) ?? []);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issueId]);

  async function post(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!supabase) return;
    const trimmedName = name.trim();
    const trimmedBody = body.trim();
    if (honeypot.current?.value) return; // bot
    if (trimmedName.length < 2) {
      setError("Adınızı yazın (ən azı 2 simvol).");
      return;
    }
    if (!trimmedBody) {
      setError("Şərh boşdur.");
      return;
    }
    setPosting(true);
    const { data, error: err } = await supabase
      .from("comments")
      .insert({ issue_id: issueId, author_name: trimmedName, body: trimmedBody })
      .select()
      .single();
    setPosting(false);
    if (err) {
      setError("Şərh göndərilmədi. Yenidən cəhd edin.");
      return;
    }
    try {
      localStorage.setItem(NAME_KEY, trimmedName);
    } catch {
      // ignore
    }
    setComments((prev) => [...(prev ?? []), data as IssueComment]);
    setBody("");
  }

  async function remove(id: string) {
    if (!supabase) return;
    if (!confirm("Bu şərh silinsin?")) return;
    const { error: err } = await supabase.from("comments").delete().eq("id", id);
    if (err) {
      setError("Silinmədi. Redaktor kimi daxil olduğunuzdan əmin olun.");
      return;
    }
    setComments((prev) => (prev ?? []).filter((c) => c.id !== id));
  }

  const count = comments?.length ?? 0;

  return (
    <section id="comments" className="glass scroll-mt-24 p-6 sm:p-8">
      <div className="mb-6 flex items-baseline justify-between gap-4">
        <h2 className="font-serif text-2xl font-semibold text-ink dark:text-brand-cream">
          Müzakirə{" "}
          <span className="num align-middle text-base font-normal text-ink/45 dark:text-white/45">
            {comments === null ? "" : `· ${count}`}
          </span>
        </h2>
        <p className="hidden text-[11px] text-ink/45 dark:text-white/45 sm:block">
          Hər kəsə görünür
        </p>
      </div>

      {comments === null ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="skeleton h-16 rounded-xl" />
          ))}
        </div>
      ) : count === 0 ? (
        <p className="mb-2 text-sm text-ink/55 dark:text-white/55">
          Hələ şərh yoxdur — bu buraxılış haqqında ilk fikri siz bildirin.
        </p>
      ) : (
        <ul className="space-y-4">
          {comments.map((c) => (
            <li key={c.id} className="group flex gap-3.5">
              <span
                aria-hidden
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/40 text-[0.72rem] font-semibold text-white/95"
                style={{ background: `hsl(${hueOf(c.author_name)} 35% 38% / 0.95)` }}
              >
                {initials(c.author_name)}
              </span>
              <div className="min-w-0 grow">
                <div className="flex flex-wrap items-baseline gap-2.5">
                  <span className="text-sm font-semibold text-ink dark:text-white/90">
                    {c.author_name}
                  </span>
                  <time
                    className="text-[11px] text-ink/45 dark:text-white/45"
                    title={new Date(c.created_at).toLocaleString("az-AZ")}
                  >
                    {timeAgo(c.created_at)}
                  </time>
                  {canModerate && (
                    <button
                      type="button"
                      onClick={() => remove(c.id)}
                      className="cursor-pointer text-[11px] text-brand-red/70 opacity-0 transition-opacity hover:text-brand-red group-hover:opacity-100 dark:text-red-300/70"
                    >
                      sil
                    </button>
                  )}
                </div>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink/80 dark:text-white/80">
                  {c.body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={post} className="mt-7 border-t border-brand-wood-ring/70 pt-6 dark:border-white/10">
        <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Adınız"
            maxLength={60}
            className="field sm:self-start"
            aria-label="Adınız"
          />
          <div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Şərh yazın…"
              rows={3}
              maxLength={2000}
              className="field min-h-[84px] resize-y"
              aria-label="Şərh"
            />
            <div className="mt-2.5 flex items-center justify-between">
              <span className="num text-[11px] text-ink/45 dark:text-white/45">{body.length}/2000</span>
              <button type="submit" disabled={posting || !supabase} className="btn btn-primary !py-2.5">
                {posting ? "Göndərilir…" : "Şərh göndər"}
              </button>
            </div>
          </div>
        </div>
        {/* honeypot — real people never see or fill this */}
        <input
          ref={honeypot}
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          className="hidden"
          aria-hidden
        />
        {error && <p className="mt-3 text-sm text-brand-red dark:text-red-300">{error}</p>}
      </form>
    </section>
  );
}
