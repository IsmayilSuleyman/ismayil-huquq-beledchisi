"use client";

import { useEffect, useRef, useState } from "react";
import { getBrowserSupabase } from "@/lib/gazette/supabase";
import { timeAgo } from "@/lib/gazette/format";
import type { IssueComment } from "@/lib/gazette/types";

const NAME_KEY = "olg-commenter-name";

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

export default function Comments({ issueId }: { issueId: string }) {
  const supabase = getBrowserSupabase();
  const [comments, setComments] = useState<IssueComment[] | null>(null);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const honeypot = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(localStorage.getItem(NAME_KEY) ?? "");
    void supabase.auth.getSession().then(({ data }) => setIsAdmin(Boolean(data.session)));
    void supabase
      .from("comments")
      .select("*")
      .eq("issue_id", issueId)
      .order("created_at", { ascending: true })
      .then(({ data, error: err }) => {
        if (err) setError("Couldn’t load comments. Refresh to retry.");
        setComments((data as IssueComment[]) ?? []);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issueId]);

  async function post(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmedName = name.trim();
    const trimmedBody = body.trim();
    if (honeypot.current?.value) return; // bot
    if (trimmedName.length < 2) {
      setError("Please add your name (at least 2 characters).");
      return;
    }
    if (!trimmedBody) {
      setError("The comment is empty.");
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
      setError("Couldn’t post the comment. Please try again.");
      return;
    }
    localStorage.setItem(NAME_KEY, trimmedName);
    setComments((prev) => [...(prev ?? []), data as IssueComment]);
    setBody("");
  }

  async function remove(id: string) {
    if (!confirm("Delete this comment?")) return;
    const { error: err } = await supabase.from("comments").delete().eq("id", id);
    if (err) {
      setError("Delete failed — are you still signed in as admin?");
      return;
    }
    setComments((prev) => (prev ?? []).filter((c) => c.id !== id));
  }

  const count = comments?.length ?? 0;

  return (
    <section id="comments" className="olg-glass rounded-2xl p-6 sm:p-8 scroll-mt-24">
      <div className="flex items-baseline justify-between gap-4 mb-6">
        <h2 className="font-serif text-2xl">
          Discussion{" "}
          <span className="text-silver text-base align-middle">
            {comments === null ? "" : `· ${count}`}
          </span>
        </h2>
        <p className="text-[0.7rem] text-silver hidden sm:block">
          Visible to everyone with the link
        </p>
      </div>

      {comments === null ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="olg-skeleton h-16 rounded-xl" />
          ))}
        </div>
      ) : count === 0 ? (
        <p className="text-sm text-foreground/55 mb-2">
          No comments yet — be the first to share a thought on this issue.
        </p>
      ) : (
        <ul className="space-y-4">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-3.5 group">
              <span
                aria-hidden
                className="shrink-0 w-9 h-9 rounded-full grid place-items-center text-[0.72rem] font-semibold text-white/95 border border-white/15"
                style={{ background: `hsl(${hueOf(c.author_name)} 45% 34% / 0.95)` }}
              >
                {initials(c.author_name)}
              </span>
              <div className="min-w-0 grow">
                <div className="flex items-baseline gap-2.5 flex-wrap">
                  <span className="text-sm font-semibold text-foreground/95">{c.author_name}</span>
                  <time
                    className="text-[0.68rem] text-silver"
                    title={new Date(c.created_at).toLocaleString()}
                  >
                    {timeAgo(c.created_at)}
                  </time>
                  {isAdmin && (
                    <button
                      onClick={() => remove(c.id)}
                      className="text-[0.68rem] text-red-300/70 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      delete
                    </button>
                  )}
                </div>
                <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap break-words mt-0.5">
                  {c.body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={post} className="mt-7 pt-6 border-t olg-hairline">
        <div className="grid sm:grid-cols-[220px_1fr] gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            maxLength={60}
            className="olg-field sm:self-start"
            aria-label="Your name"
          />
          <div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Add a comment for colleagues…"
              rows={3}
              maxLength={2000}
              className="olg-field resize-y min-h-[84px]"
              aria-label="Comment"
            />
            <div className="flex items-center justify-between mt-2.5">
              <span className="text-[0.68rem] text-silver tabular-nums">{body.length}/2000</span>
              <button type="submit" disabled={posting} className="olg-btn olg-btn-primary !py-2.5">
                {posting ? "Posting…" : "Post comment"}
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
        {error && <p className="text-sm text-red-300 mt-3">{error}</p>}
      </form>
    </section>
  );
}
