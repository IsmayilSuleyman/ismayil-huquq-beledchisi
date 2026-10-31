"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

// Calm motion for lists that change: the board's notes when a filter
// changes, the library's cards as a search narrows. Every direct child
// with a `data-flip` key is tracked. Children that stay glide from where
// they were to where they are now; new ones fade up into place. Leaving
// ones can be faded out first with `exit`, before the list changes.
// Everything runs on one slow ease-in-out curve, and not at all for
// readers who ask for reduced motion.

export const EASE = "cubic-bezier(0.45, 0, 0.15, 1)";
const MOVE_MS = 520;
const ENTER_MS = 420;
const EXIT_MS = 220;

export function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** The tracked children that are actually laid out (a `hidden` one has no box to move). */
function items(container: HTMLElement): HTMLElement[] {
  return Array.from(container.children).filter(
    (el): el is HTMLElement => el instanceof HTMLElement && !!el.dataset.flip && el.getClientRects().length > 0,
  );
}

/** Each item's offset inside the container, so scrolling between two changes doesn't count as movement. */
function measure(container: HTMLElement): Map<string, { x: number; y: number }> {
  const box = container.getBoundingClientRect();
  return new Map(
    items(container).map((el) => {
      const r = el.getBoundingClientRect();
      return [el.dataset.flip!, { x: r.left - box.left, y: r.top - box.top }];
    }),
  );
}

/**
 * Animates the container's items whenever `key` changes (a string naming
 * what is shown, say). Returns `exit(staying)`, which fades out every item
 * whose key is not in `staying` and resolves when they are gone from view.
 */
export function useFlip(container: RefObject<HTMLElement | null>, key: string, { enter = true } = {}) {
  const last = useRef<Map<string, { x: number; y: number }> | null>(null);
  const height = useRef(0);

  useLayoutEffect(() => {
    const el = container.current;
    if (!el) return;
    const before = last.current;
    for (const item of items(el)) item.getAnimations().forEach((a) => a.cancel());
    el.getAnimations().forEach((a) => a.cancel());
    last.current = measure(el);
    const wasHeight = height.current;
    height.current = el.offsetHeight;
    if (!before || reducedMotion()) return;

    // The list's own height eases too, so the board doesn't snap shut or open.
    if (wasHeight && wasHeight !== height.current) {
      el.animate([{ height: `${wasHeight}px` }, { height: `${height.current}px` }], { duration: MOVE_MS, easing: EASE });
    }

    let entering = 0;
    for (const item of items(el)) {
      const now = last.current.get(item.dataset.flip!)!;
      const was = before.get(item.dataset.flip!);
      if (was) {
        const dx = was.x - now.x;
        const dy = was.y - now.y;
        if (dx || dy) {
          item.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }], {
            duration: MOVE_MS,
            easing: EASE,
          });
        }
      } else if (enter) {
        item.animate(
          [
            { opacity: 0, transform: "translateY(10px) scale(0.98)" },
            { opacity: 1, transform: "translateY(0) scale(1)" },
          ],
          { duration: ENTER_MS, easing: EASE, delay: Math.min(entering++, 8) * 35, fill: "backwards" },
        );
      }
    }
  }, [container, key, enter]);

  // A resize reflows the grid; remeasure so the next change starts from the truth.
  useEffect(() => {
    const onResize = () => {
      if (!container.current) return;
      last.current = measure(container.current);
      height.current = container.current.offsetHeight;
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [container]);

  return useCallback(
    (staying: Set<string>): Promise<void> => {
      const el = container.current;
      if (!el || reducedMotion()) return Promise.resolve();
      const leaving = items(el).filter((item) => !staying.has(item.dataset.flip!));
      if (leaving.length === 0) return Promise.resolve();
      const runs = leaving.map((item) =>
        item.animate(
          [
            { opacity: 1, transform: "scale(1)" },
            { opacity: 0, transform: "scale(0.96)" },
          ],
          { duration: EXIT_MS, easing: "ease-in", fill: "forwards" },
        ),
      );
      return Promise.all(runs.map((a) => a.finished.catch(() => undefined))).then(() => undefined);
    },
    [container],
  );
}

/**
 * For dialogs and sheets: `close()` plays the closing animation (the
 * element gets `closing` = true, which the caller styles), then calls
 * `onClose` once it has finished.
 */
export function useClosing(onClose: () => void, ms = 220): [boolean, () => void] {
  const [closing, setClosing] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  // The latest onClose, so `close` stays the same function across renders.
  const done = useRef(onClose);
  useEffect(() => {
    done.current = onClose;
  });
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const close = useCallback(() => {
    if (reducedMotion()) return done.current();
    setClosing(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => done.current(), ms);
  }, [ms]);
  return [closing, close];
}
