"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { getBrowserSupabase } from "@/lib/gazette/supabase";

// The bell in the gazette header: subscribes this browser to a push notice
// for every new issue (sent by lib/gazette/push.ts), or turns it off again.
// No account needed; the subscription is stored through the push_subscribe
// function (see the gazette_push migration). The bell stays hidden until an
// admin has set notifications up (Settings → Notifications in /admin).
// Once on, the bell "docks": its label folds away, then it glides past the
// Admin pill to the far right of the header as just the icon.

type State = "hidden" | "off" | "on" | "busy" | "denied" | "install";

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function pushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** iPhones and iPads get push only in a site opened from the home screen. */
function needsHomeScreen() {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia("(display-mode: standalone)").matches;
  return ios && !standalone;
}

/** How long the lit-up "Notifications on" pill stays put before it docks. */
const DOCK_DELAY_MS = 1600;
/** The label folds away (and the note fades) for this long before the bell moves. */
const FOLD_MS = 450;
/** The glide across the header. */
const SLIDE_MS = 900;
const EASE = "cubic-bezier(0.45, 0, 0.15, 1)";

async function currentSubscription() {
  const reg = await navigator.serviceWorker.getRegistration("/");
  return reg ? reg.pushManager.getSubscription() : null;
}

export default function NotifyButton() {
  const [state, setState] = useState<State>("hidden");
  const [note, setNote] = useState<string | null>(null);
  const [vapidKey, setVapidKey] = useState<string | null>(null);
  const [docked, setDocked] = useState(false);
  // While docking: the label folds, the note fades, then the bell glides.
  const [moving, setMoving] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  // Where the header's items sat just before a dock/undock, for the slide.
  const before = useRef<Map<Element, number> | null>(null);
  const timers = useRef<number[]>([]);

  function changeDock(next: boolean) {
    const items = rootRef.current?.parentElement?.children;
    before.current = items ? new Map(Array.from(items, (el) => [el, el.getBoundingClientRect().left])) : null;
    setDocked(next);
  }

  function later(fn: () => void, ms: number) {
    timers.current.push(window.setTimeout(fn, ms));
  }

  function clearTimers() {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }

  /** Docks (or undocks) in three calm steps: fold the label, glide, settle. */
  function dock(next: boolean) {
    clearTimers();
    setMoving(true);
    later(() => changeDock(next), next ? FOLD_MS : 0);
    later(() => setMoving(false), (next ? FOLD_MS : 0) + SLIDE_MS);
  }

  // FLIP: every header item starts where it was and glides to its new spot,
  // all on one slow ease-in-out curve so nothing jumps.
  useLayoutEffect(() => {
    const from = before.current;
    before.current = null;
    if (!from || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    for (const [el, left] of from) {
      const dx = left - el.getBoundingClientRect().left;
      if (!dx) continue;
      // The bell dims a little mid-glide, so crossing the other items reads as a soft pass.
      const frames =
        el === rootRef.current
          ? [
              { transform: `translateX(${dx}px)`, opacity: 1 },
              { opacity: 0.45, offset: 0.5 },
              { transform: "translateX(0)", opacity: 1 },
            ]
          : [{ transform: `translateX(${dx}px)` }, { transform: "translateX(0)" }];
      el.animate(frames, { duration: SLIDE_MS, easing: EASE });
    }
  }, [docked]);

  useEffect(() => clearTimers, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await getBrowserSupabase().rpc("push_public_key");
      if (cancelled || typeof data !== "string" || !data) return;
      setVapidKey(data);
      if (!pushSupported()) {
        if (needsHomeScreen()) setState("install");
        return;
      }
      if (Notification.permission === "denied") return setState("denied");
      const sub = await currentSubscription().catch(() => null);
      if (cancelled) return;
      const on = !!sub && Notification.permission === "granted";
      setState(on ? "on" : "off");
      setDocked(on);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function subscribe() {
    setState("busy");
    setNote(null);
    try {
      await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      const reg = await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(vapidKey!) }));
      const json = sub.toJSON();
      const { error } = await getBrowserSupabase().rpc("push_subscribe", {
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
      });
      if (error) {
        await sub.unsubscribe();
        throw new Error(error.message);
      }
      setState("on");
      setNote("Thank you for enabling notifications, which you’ll receive once the newer issue is available.");
      later(() => dock(true), DOCK_DELAY_MS);
    } catch (e) {
      setState("off");
      setNote(`Couldn’t turn notifications on: ${(e as Error).message}`);
    }
  }

  async function unsubscribe() {
    clearTimers();
    setState("busy");
    setNote(null);
    try {
      const sub = await currentSubscription();
      if (sub) {
        await getBrowserSupabase().rpc("push_unsubscribe", { endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setState("off");
      dock(false);
      setNote("Notifications are off for this browser.");
    } catch (e) {
      setState("on");
      setNote(`Couldn’t turn notifications off: ${(e as Error).message}`);
    }
  }

  function onClick() {
    if (state === "off") return void subscribe();
    if (state === "on") return void unsubscribe();
    if (state === "denied") {
      return setNote(note ? null : "Notifications are blocked for this site. Allow them in your browser’s site settings, then tap the bell again.");
    }
    if (state === "install") {
      return setNote(note ? null : "On iPhone and iPad: tap Share, then “Add to Home Screen”. Open the gazette from the home screen and tap the bell there.");
    }
  }

  if (state === "hidden") return null;

  const on = state === "on";
  // The label is folded while docked and during the moves in and out.
  const folded = docked || moving;
  const label = on ? "Notifications on" : "Notify me";
  const title = on ? "You’ll be notified of new issues. Tap to turn off." : "Get a notification when a new issue is out";

  return (
    <div ref={rootRef} className={`relative shrink-0 ${docked ? "order-last" : ""}`}>
      <button
        type="button"
        onClick={onClick}
        disabled={state === "busy"}
        title={title}
        aria-label={title}
        aria-pressed={on}
        className={`inline-flex items-center py-2 rounded-lg transition-all duration-[450ms] ease-in-out disabled:opacity-60 ${
          folded ? "px-2.5" : "px-3"
        } ${
          on ? "text-azure-soft bg-omni/40 hover:bg-omni/60" : "text-silver hover:text-foreground hover:bg-veil/[0.08]"
        }`}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill={on ? "currentColor" : "none"} aria-hidden>
          <path
            d="M6 9a6 6 0 1 1 12 0c0 4.5 1.5 6.5 2.5 7.5h-17C4.5 15.5 6 13.5 6 9Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path d="M10 19.5a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          {state === "denied" && <path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />}
        </svg>
        <span
          className={`hidden md:inline-block overflow-hidden whitespace-nowrap transition-all duration-[450ms] ease-in-out ${
            folded ? "max-w-0 ml-0 opacity-0" : "max-w-[10rem] ml-1.5 opacity-100"
          }`}
        >
          {state === "busy" ? "…" : label}
        </span>
      </button>
      {note && (
        // The note fades while the bell moves (the outer box), and rises in when it first shows (the inner one).
        <div
          className={`absolute right-0 top-full mt-2 w-72 max-w-[calc(100vw-2rem)] z-50 transition-opacity duration-300 ${
            moving ? "opacity-0" : "opacity-100"
          }`}
        >
          <div role="status" className="olg-rise olg-glass-deep rounded-xl p-3.5 text-xs leading-relaxed text-foreground/85">
            {note}
            <button
              type="button"
              onClick={() => setNote(null)}
              className="block mt-2 text-azure hover:underline"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
