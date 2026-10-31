import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Announces something new in the library to the browsers subscribed from
 * the bell in the gazette header: a new issue, a new Constitutional Court
 * summary or a new book. Each browser chose which of the three it hears
 * about (push_subscriptions.topics). Runs server-side only: from the
 * publish scripts (as the publisher) and from /api/gazette/notify (as an
 * admin). The VAPID keys and the subscriptions are readable only by those
 * two roles (supabase/migrations/20261030180000_gazette_push.sql and
 * 20261031220000_push_topics.sql).
 */

import { PUSH_TOPICS, TOPIC_LABEL, describeSend, type PushResult, type PushTopic } from "@/lib/gazette/push-topics";

export { PUSH_TOPICS, TOPIC_LABEL, describeSend, type PushResult, type PushTopic };

export type NoticeKind = "issue" | "summary" | "book";

/** One notice: what push_sends records it as, who gets it, and what the service worker shows. */
export type PushNotice = {
  kind: NoticeKind;
  /** The issue number, the decision id or the book id: with `kind`, the key in push_sends. */
  ref: string;
  topic: PushTopic;
  title: string;
  body: string;
  url: string;
  tag: string;
};

export type PushIssue = { issue_number: number; title: string };
export type PushSummary = { decision_id: number; kind: "qərar" | "qərardad"; decision_date: string; topic: string };
export type PushBook = { id: string; title: string; author: string | null };

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" });

export function noticeForIssue(issue: PushIssue): PushNotice {
  return {
    kind: "issue",
    ref: String(issue.issue_number),
    topic: "issues",
    title: `Omni Law Gazette · No. ${issue.issue_number}`,
    body: issue.title,
    url: `/issues/${issue.issue_number}`,
    tag: `issue-${issue.issue_number}`,
  };
}

export function noticeForSummary(summary: PushSummary): PushNotice {
  const kind = summary.kind === "qərar" ? "Qərar" : "Qərardad";
  const date = dateFmt.format(new Date(`${summary.decision_date.slice(0, 10)}T00:00:00`));
  return {
    kind: "summary",
    ref: String(summary.decision_id),
    topic: "summaries",
    title: `Constitutional Court · ${kind} of ${date}`,
    body: summary.topic,
    url: `/summaries/${summary.decision_id}`,
    tag: `summary-${summary.decision_id}`,
  };
}

export function noticeForBook(book: PushBook): PushNotice {
  return {
    kind: "book",
    ref: book.id,
    topic: "books",
    title: "New book on the shelf",
    body: book.author ? `${book.author} · ${book.title}` : book.title,
    url: `/books/${book.id}`,
    tag: `book-${book.id}`,
  };
}

/** What the service worker (public/sw.js) shows. */
export function payloadFor(notice: PushNotice) {
  return { title: notice.title, body: notice.body, url: notice.url, tag: notice.tag };
}

/**
 * Sends `notice` once to the browsers subscribed to its topic. Without
 * `force`, a notice already in push_sends is left alone. Subscriptions the
 * push service reports as gone (404/410: the reader unsubscribed or cleared
 * the browser) are deleted.
 */
export async function sendNotice(
  db: SupabaseClient,
  notice: PushNotice,
  { force = false }: { force?: boolean } = {},
): Promise<PushResult> {
  const config = await db.from("push_config").select("vapid_public,vapid_private,subject").maybeSingle();
  if (config.error) throw new Error(`Could not read the push keys: ${config.error.message}`);
  if (!config.data) throw new Error("Push isn't set up, or this account may not send notices (no push_config row visible)");

  const key = { kind: notice.kind, ref: notice.ref };
  // Issues keep their number in its own column: the admin desk lists sends by it.
  const row = { ...key, issue_number: notice.kind === "issue" ? Number(notice.ref) : null };
  const claim = force
    ? await db.from("push_sends").upsert({ ...row, sent_at: new Date().toISOString(), delivered: 0 })
    : await db.from("push_sends").insert(row);
  if (claim.error) {
    if (claim.error.code !== "23505") throw new Error(`Could not record the send: ${claim.error.message}`);
    const prev = await db.from("push_sends").select("sent_at").match(key).single();
    return { status: "already-sent", sentAt: prev.data?.sent_at ?? "" };
  }

  const subs = await db
    .from("push_subscriptions")
    .select("endpoint,p256dh,auth")
    .contains("topics", [notice.topic])
    .range(0, 49_999);
  if (subs.error) throw new Error(`Could not read the subscriptions: ${subs.error.message}`);

  const payload = JSON.stringify(payloadFor(notice));
  const options = {
    vapidDetails: {
      subject: config.data.subject,
      publicKey: config.data.vapid_public,
      privateKey: config.data.vapid_private,
    },
    TTL: 7 * 24 * 3600,
    urgency: "normal" as const,
  };

  let delivered = 0;
  let failed = 0;
  const gone: string[] = [];
  const queue = [...subs.data];
  // A few at a time: push services are fast, but there is no need to rush them.
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      for (let s = queue.shift(); s; s = queue.shift()) {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, options);
          delivered++;
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) gone.push(s.endpoint);
          else failed++;
        }
      }
    }),
  );

  if (gone.length > 0) await db.from("push_subscriptions").delete().in("endpoint", gone);
  await db.from("push_sends").update({ delivered }).match(key);

  return { status: "sent", subscribers: subs.data.length, delivered, removed: gone.length, failed };
}

/** The weekly publisher's call: announce an issue. */
export function notifyNewIssue(db: SupabaseClient, issue: PushIssue, opts: { force?: boolean } = {}): Promise<PushResult> {
  return sendNotice(db, noticeForIssue(issue), opts);
}

/** The daily publisher's call: announce a Constitutional Court summary. */
export function notifyNewSummary(db: SupabaseClient, summary: PushSummary, opts: { force?: boolean } = {}): Promise<PushResult> {
  return sendNotice(db, noticeForSummary(summary), opts);
}

/** The admin desk's call after a book is added. */
export function notifyNewBook(db: SupabaseClient, book: PushBook, opts: { force?: boolean } = {}): Promise<PushResult> {
  return sendNotice(db, noticeForBook(book), opts);
}
