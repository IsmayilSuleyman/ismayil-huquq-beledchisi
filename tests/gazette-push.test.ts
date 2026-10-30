import { webcrypto } from "node:crypto";
import webpush from "web-push";
import { describe, expect, it } from "vitest";
import { notificationFor } from "@/lib/gazette/push";

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

    const request = webpush.generateRequestDetails(subscription, JSON.stringify(notificationFor({ issue_number: 13, title: "T" })), {
      vapidDetails: { subject: "https://omnilawgazette.vercel.app", publicKey, privateKey },
    });
    expect(request.headers.Authorization).toMatch(new RegExp(`^vapid t=.+, k=${publicKey}$`));
    expect(request.endpoint).toBe(subscription.endpoint);
  });

  it("opens the issue when the notice is tapped", () => {
    expect(notificationFor({ issue_number: 13, title: "Weekly Legislature Update" })).toEqual({
      title: "Omni Law Gazette · No. 13",
      body: "Weekly Legislature Update",
      url: "/issues/13",
      tag: "issue-13",
    });
  });
});
