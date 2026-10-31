import { webcrypto } from "node:crypto";
import webpush from "web-push";
import { describe, expect, it } from "vitest";
import { noticeForBook, noticeForIssue, noticeForSummary, payloadFor } from "@/lib/gazette/push";
import { describeSend } from "@/lib/gazette/push-topics";

const b64url = (b: ArrayBuffer) => Buffer.from(b).toString("base64url");

describe("gazette push", () => {
  it("signs with a key pair made the way the admin desk makes it", async () => {
    // Same steps as generateVapidKeys() in NotificationsPanel.tsx.
    const pair = await webcrypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
    const publicKey = b64url(await webcrypto.subtle.exportKey("raw", pair.publicKey));
    const privateKey = (await webcrypto.subtle.exportKey("jwk", pair.privateKey)).d!;

    // A browser's subscription keys, faked with another pair.
    const browser = await webcrypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
    const subscription = {
      endpoint: "https://fcm.googleapis.com/fcm/send/abc",
      keys: {
        p256dh: b64url(await webcrypto.subtle.exportKey("raw", browser.publicKey)),
        auth: Buffer.from(webcrypto.getRandomValues(new Uint8Array(16))).toString("base64url"),
      },
    };

    const payload = JSON.stringify(payloadFor(noticeForIssue({ issue_number: 13, title: "T" })));
    const request = webpush.generateRequestDetails(subscription, payload, {
      vapidDetails: { subject: "https://omnilawgazette.vercel.app", publicKey, privateKey },
    });
    expect(request.headers.Authorization).toMatch(new RegExp(`^vapid t=.+, k=${publicKey}$`));
    expect(request.endpoint).toBe(subscription.endpoint);
  });

  it("opens the issue when the notice is tapped, and goes to the issues topic", () => {
    const notice = noticeForIssue({ issue_number: 13, title: "Weekly Legislature Update" });
    expect(notice).toMatchObject({ kind: "issue", ref: "13", topic: "issues" });
    expect(payloadFor(notice)).toEqual({
      title: "Omni Law Gazette · No. 13",
      body: "Weekly Legislature Update",
      url: "/issues/13",
      tag: "issue-13",
    });
  });

  it("names a court summary by its form and date, and a book by its title", () => {
    const summary = noticeForSummary({
      decision_id: 1630,
      kind: "qərardad",
      decision_date: "2026-09-25",
      topic: "Do the rules on bona fide acquisition apply to registered movables?",
    });
    expect(summary).toMatchObject({ kind: "summary", ref: "1630", topic: "summaries", url: "/summaries/1630", tag: "summary-1630" });
    expect(summary.title).toBe("Constitutional Court · Qərardad of 25 September 2026");
    expect(summary.body).toBe("Do the rules on bona fide acquisition apply to registered movables?");

    const book = noticeForBook({ id: "0f1e2d3c-0000-4000-8000-000000000000", title: "Mülki Məcəllənin Kommentariyası", author: "A. Əliyev" });
    expect(book).toMatchObject({ kind: "book", topic: "books", url: "/books/0f1e2d3c-0000-4000-8000-000000000000" });
    expect(book.body).toBe("A. Əliyev · Mülki Məcəllənin Kommentariyası");
  });

  it("describes a send in one line", () => {
    expect(describeSend({ status: "sent", subscribers: 4, delivered: 3, removed: 1, failed: 0 })).toBe(
      "notified 3 of 4 subscriber(s); 1 expired subscription(s) removed",
    );
    expect(describeSend({ status: "already-sent", sentAt: "2026-10-31T06:00:00Z" })).toBe("already notified on 2026-10-31");
  });
});
