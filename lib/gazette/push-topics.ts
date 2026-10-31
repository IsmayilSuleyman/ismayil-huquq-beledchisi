/**
 * The part of the push notices the browser needs too: the three topics a
 * reader can subscribe to, their labels, and the shape of a send's result.
 * lib/gazette/push.ts (server-only: it loads web-push) re-exports these.
 */

export const PUSH_TOPICS = ["issues", "summaries", "books"] as const;
export type PushTopic = (typeof PUSH_TOPICS)[number];

/** What the bell's menu calls each topic. */
export const TOPIC_LABEL: Record<PushTopic, { label: string; hint: string }> = {
  issues: { label: "Gazette issues", hint: "The weekly legislature digest" },
  summaries: { label: "Court summaries", hint: "New Constitutional Court decisions, summarised" },
  books: { label: "Books", hint: "New legal texts on the shelf" },
};

export type PushResult =
  | { status: "already-sent"; sentAt: string }
  | { status: "sent"; subscribers: number; delivered: number; removed: number; failed: number };

/** A one-line account of a send, for logs and the admin desk. */
export function describeSend(result: PushResult): string {
  if (result.status === "already-sent") return `already notified on ${result.sentAt.slice(0, 10)}`;
  return (
    `notified ${result.delivered} of ${result.subscribers} subscriber(s)` +
    (result.removed ? `; ${result.removed} expired subscription(s) removed` : "") +
    (result.failed ? `; ${result.failed} failed` : "")
  );
}
