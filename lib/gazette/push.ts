import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Announces a new issue to every browser subscribed from the bell in the
 * gazette header. Runs server-side only: from the publish script (as the
 * publisher) and from /api/gazette/notify (as an admin). The VAPID keys
 * and the subscriptions are readable only by those two roles (see
 * supabase/migrations/20261030180000_gazette_push.sql).
 */

export type PushIssue = { issue_number: number; title: string };

export type PushResult =
  | { status: "already-sent"; sentAt: string }
  | { status: "sent"; subscribers: number; delivered: number; removed: number; failed: number };

/** What the service worker (public/sw.js) shows. */
export function notificationFor(issue: PushIssue) {
  return {
    title: `Omni Law Gazette · No. ${issue.issue_number}`,
    body: issue.title,
    url: `/issues/${issue.issue_number}`,
    tag: `issue-${issue.issue_number}`,
  };
}

/**
 * Sends the notice for `issue` once. Without `force`, an issue already in
 * push_sends is left alone. Subscriptions the push service reports as
 * gone (404/410: the reader unsubscribed or cleared the browser) are deleted.
 */
export async function notifyNewIssue(
  db: SupabaseClient,
  issue: PushIssue,
  { force = false }: { force?: boolean } = {},
): Promise<PushResult> {
  const config = await db.from("push_config").select("vapid_public,vapid_private,subject").maybeSingle();
  if (config.error) throw new Error(`Could not read the push keys: ${config.error.message}`);
  if (!config.data) throw new Error("Push isn't set up, or this account may not send notices (no push_config row visible)");

  const claim = force
    ? await db.from("push_sends").upsert({ issue_number: issue.issue_number, sent_at: new Date().toISOString(), delivered: 0 })
    : await db.from("push_sends").insert({ issue_number: issue.issue_number });
  if (claim.error) {
    if (claim.error.code !== "23505") throw new Error(`Could not record the send: ${claim.error.message}`);
    const prev = await db.from("push_sends").select("sent_at").eq("issue_number", issue.issue_number).single();
    return { status: "already-sent", sentAt: prev.data?.sent_at ?? "" };
  }

  const subs = await db.from("push_subscriptions").select("endpoint,p256dh,auth").range(0, 49_999);
  if (subs.error) throw new Error(`Could not read the subscriptions: ${subs.error.message}`);

  const payload = JSON.stringify(notificationFor(issue));
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
  await db.from("push_sends").update({ delivered }).eq("issue_number", issue.issue_number);

  return { status: "sent", subscribers: subs.data.length, delivered, removed: gone.length, failed };
}
