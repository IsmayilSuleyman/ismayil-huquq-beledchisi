"use client";

import { useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/gazette/supabase";

function base64url(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * The VAPID key pair that signs push notices, made here in the browser and
 * saved to push_config, so the private key never leaves this page and the
 * database. Readers' bells appear once it exists.
 */
async function generateVapidKeys() {
  const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const publicRaw = await crypto.subtle.exportKey("raw", pair.publicKey);
  const privateJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  if (!privateJwk.d) throw new Error("The browser did not export the private key");
  return { vapid_public: base64url(publicRaw), vapid_private: privateJwk.d };
}

export default function NotificationsPanel() {
  const supabase = getBrowserSupabase();
  const [ready, setReady] = useState<boolean | null>(null);
  const [subscribers, setSubscribers] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const key = await supabase.rpc("push_public_key");
    setReady(typeof key.data === "string" && key.data.length > 0);
    const count = await supabase.from("push_subscriptions").select("endpoint", { count: "exact", head: true });
    setSubscribers(count.error ? null : (count.count ?? 0));
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function setUp() {
    setBusy(true);
    setMsg(null);
    try {
      const keys = await generateVapidKeys();
      const { error } = await supabase
        .from("push_config")
        .insert({ id: 1, ...keys, subject: window.location.origin });
      if (error) throw new Error(error.code === "23505" ? "Notifications are already set up." : error.message);
      await load();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="olg-glass rounded-2xl p-6 sm:p-7">
      <h2 className="font-serif text-xl mb-1.5">Notifications</h2>
      <p className="text-xs text-silver mb-5 leading-relaxed">
        Readers tap the bell in the header to get a browser notification for each new issue. The
        weekly publisher sends it automatically; for an issue you upload here, press Notify under
        Manage issues.
      </p>
      {ready === null ? (
        <div className="olg-skeleton h-10 rounded-lg" />
      ) : ready ? (
        <p className="text-sm">
          <span className="text-emerald-300">● On.</span>{" "}
          {subscribers === null
            ? ""
            : `${subscribers} browser${subscribers === 1 ? "" : "s"} subscribed.`}
        </p>
      ) : (
        <button onClick={() => void setUp()} disabled={busy} className="olg-btn olg-btn-primary">
          {busy ? "Setting up…" : "Turn on notifications"}
        </button>
      )}
      {msg && <p className="text-sm text-red-300 mt-3">{msg}</p>}
    </section>
  );
}
