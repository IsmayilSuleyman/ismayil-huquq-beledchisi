"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import {
  addHighlight,
  deleteHighlight,
  updateHighlight,
  type AddHighlightResult,
  type HighlightPatch,
  type ToggleResult,
} from "@/app/(guide)/courses/[course]/[lesson]/actions";
import {
  anchorFromOffsets,
  COLOR_LABELS,
  excerpt,
  HIGHLIGHT_COLORS,
  locateAnchor,
  MAX_NOTE,
  sortHighlights,
  type Highlight,
  type HighlightColor,
  type TextAnchor,
} from "@/lib/highlights";
import {
  applyHighlight,
  highlightRects,
  offsetsFromRange,
  removeAllHighlights,
  removeHighlight,
  renameHighlight,
  restyleHighlight,
  revealHighlight,
  rootText,
} from "@/lib/highlights-dom";

/**
 * Wraps the rendered lesson body and lets the reader select a passage,
 * highlight it in one of four colours and attach a note. Marks are inserted
 * straight into the rendered DOM (see lib/highlights-dom.ts); the list under
 * the lesson and the popover are ordinary React.
 *
 * Every change is optimistic: the mark appears at once, the server action
 * runs in the background, and a failure rolls the change back with a
 * message. A highlight made moments ago may still carry a temporary id;
 * edits and deletions made in that window are queued and replayed once the
 * server has assigned the real one. React state identifies a highlight by a
 * stable client `key` so the id swap never remounts an editor mid-typing.
 */

type Item = Highlight & { key: string };

type Toolbar = {
  left: number;
  top: number;
  below: boolean;
  start: number;
  end: number;
  tooLong: boolean;
};

type Popover = { key: string; seq: number; left: number; top: number; below: boolean };

type Pending = { patch?: HighlightPatch; remove?: boolean };

/** The server actions the annotator calls; a harness may pass stand-ins. */
export type AnnotatorActions = {
  add: (
    courseSlug: string,
    lessonSlug: string,
    anchor: TextAnchor,
    color: HighlightColor,
  ) => Promise<AddHighlightResult>;
  update: (id: string, patch: HighlightPatch) => Promise<ToggleResult>;
  remove: (id: string) => Promise<ToggleResult>;
};

const SERVER_ACTIONS: AnnotatorActions = {
  add: addHighlight,
  update: updateHighlight,
  remove: deleteHighlight,
};

const OFFLINE = "Əlaqə kəsildi. Yenidən cəhd edin.";

/**
 * Runs a server action and turns a thrown error (network down, session
 * gone) into a failed result, so a bad connection rolls the change back
 * with a message instead of reaching the page's error boundary.
 */
async function attempt<T extends { ok: boolean }>(run: () => Promise<T>): Promise<T | { ok: false; message: string }> {
  try {
    const res = await run();
    return res ?? { ok: false, message: OFFLINE };
  } catch {
    return { ok: false, message: OFFLINE };
  }
}

const TEMP = "tmp-";
const isTemp = (id: string) => id.startsWith(TEMP);
const hasNote = (h: Pick<Highlight, "note">) => h.note.trim().length > 0;

export function LessonAnnotator({
  courseSlug,
  lessonSlug,
  initial,
  actions,
  children,
}: {
  courseSlug: string;
  lessonSlug: string;
  initial: Highlight[];
  /** Only harnesses pass this; the lesson page uses the real server actions. */
  actions?: AnnotatorActions;
  children: ReactNode;
}) {
  const api = useRef(actions ?? SERVER_ACTIONS);
  const shellRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const interacting = useRef(false);
  const pending = useRef(new Map<string, Pending>());
  const realIds = useRef(new Map<string, string>());
  const seq = useRef(0);

  const [items, setItems] = useState<Item[]>(() =>
    sortHighlights(initial.map((h) => ({ ...h, key: h.id }))),
  );
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const [orphans, setOrphans] = useState<Set<string>>(() => new Set());
  const [toolbar, setToolbar] = useState<Toolbar | null>(null);
  const [popover, setPopover] = useState<Popover | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Draw the saved highlights once the lesson is on screen.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const text = rootText(root);
    const missing = new Set<string>();
    for (const h of sortHighlights(initial)) {
      const pos = locateAnchor(text, h);
      if (!pos) {
        missing.add(h.id);
        continue;
      }
      applyHighlight(root, h.id, pos.start, pos.end, h.color, hasNote(h));
    }
    setOrphans(missing);
    return () => removeAllHighlights(root);
    // The saved list only changes through this component's own handlers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show the colour toolbar whenever a selection lands inside the lesson.
  useEffect(() => {
    const root = rootRef.current;
    const shell = shellRef.current;
    if (!root || !shell) return;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    let timer: number | undefined;

    const check = () => {
      if (interacting.current) return;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        setToolbar(null);
        return;
      }
      const range = sel.getRangeAt(0);
      if (!range.intersectsNode(root)) {
        setToolbar(null);
        return;
      }
      const offsets = offsetsFromRange(root, range);
      if (!offsets) {
        setToolbar(null);
        return;
      }
      const text = rootText(root);
      const anchor = anchorFromOffsets(text, offsets.start, offsets.end);
      const tooLong = !anchor && text.slice(offsets.start, offsets.end).trim().length > 0;
      if (!anchor && !tooLong) {
        setToolbar(null);
        return;
      }
      const rects = range.getClientRects();
      if (rects.length === 0) {
        setToolbar(null);
        return;
      }
      const first = rects[0];
      const last = rects[rects.length - 1];
      const shellRect = shell.getBoundingClientRect();
      // Phones draw their own copy/look-up bubble above the selection, so
      // ours goes below; on a desktop it sits above unless that is off-screen.
      const below = coarse || first.top < 96;
      const at = below ? last : first;
      const half = 124;
      const left = Math.min(
        Math.max(at.left + at.width / 2 - shellRect.left, half),
        Math.max(half, shellRect.width - half),
      );
      setPopover(null);
      setToolbar({
        left,
        top: below ? last.bottom - shellRect.top + 10 : first.top - shellRect.top - 10,
        below,
        start: offsets.start,
        end: offsets.end,
        tooLong,
      });
    };

    const onSelectionChange = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(check, 180);
    };
    const onPointerUp = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(check, 0);
    };
    document.addEventListener("selectionchange", onSelectionChange);
    root.addEventListener("pointerup", onPointerUp);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("selectionchange", onSelectionChange);
      root.removeEventListener("pointerup", onPointerUp);
    };
  }, []);

  // Escape closes both bubbles; a press outside the popover closes it.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        setToolbar(null);
        setPopover(null);
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (popoverRef.current && target && popoverRef.current.contains(target)) return;
      if (target instanceof Element && target.closest("mark[data-hl]")) return;
      setPopover(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  const openPopover = useCallback((key: string) => {
    const root = rootRef.current;
    const shell = shellRef.current;
    const item = itemsRef.current.find((h) => h.key === key);
    if (!root || !shell || !item) return;
    const rects = highlightRects(root, item.id);
    if (!rects) return;
    const shellRect = shell.getBoundingClientRect();
    const roomBelow = window.innerHeight - rects.last.bottom;
    const below = roomBelow > 300 || rects.first.top < 300;
    const at = below ? rects.last : rects.first;
    const half = 148;
    const left = Math.min(
      Math.max(at.left + Math.min(at.width, 200) / 2 - shellRect.left, half),
      Math.max(half, shellRect.width - half),
    );
    seq.current += 1;
    setToolbar(null);
    setError(null);
    setPopover({
      key,
      seq: seq.current,
      left,
      top: below ? rects.last.bottom - shellRect.top + 8 : rects.first.top - shellRect.top - 8,
      below,
    });
  }, []);

  /** Replays edits queued while a highlight still had its temporary id. */
  const flushPending = useCallback(async (key: string, realId: string) => {
    realIds.current.set(key, realId);
    const queued = pending.current.get(key);
    pending.current.delete(key);
    if (!queued) return;
    if (queued.remove) {
      const res = await attempt(() => api.current.remove(realId));
      if (!res.ok) setError(res.message);
      return;
    }
    if (queued.patch) {
      const patch = queued.patch;
      const res = await attempt(() => api.current.update(realId, patch));
      if (!res.ok) setError(res.message);
    }
  }, []);

  /** The server id of an item, or null while it is still being created. */
  const serverId = (item: Item): string | null =>
    isTemp(item.id) ? (realIds.current.get(item.key) ?? null) : item.id;

  const create = useCallback(
    (color: HighlightColor, withNote: boolean) => {
      const root = rootRef.current;
      const tb = toolbar;
      if (!root || !tb) return;
      const anchor = anchorFromOffsets(rootText(root), tb.start, tb.end);
      setToolbar(null);
      interacting.current = false;
      window.getSelection()?.removeAllRanges();
      if (!anchor) return;

      const tempId = `${TEMP}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const item: Item = {
        ...anchor,
        id: tempId,
        key: tempId,
        color,
        note: "",
        createdAt: new Date().toISOString(),
      };
      applyHighlight(root, tempId, anchor.start, anchor.end, color, false);
      setItems((list) => sortHighlights([...list, item]));
      setError(null);
      if (withNote) {
        // Let the marks paint before measuring where the bubble goes.
        window.requestAnimationFrame(() => openPopover(item.key));
      }

      startTransition(async () => {
        const res = await attempt(() => api.current.add(courseSlug, lessonSlug, anchor, color));
        if (!res.ok) {
          pending.current.delete(item.key);
          removeHighlight(root, tempId);
          setItems((list) => list.filter((h) => h.key !== item.key));
          setPopover((p) => (p?.key === item.key ? null : p));
          setEditingKey((k) => (k === item.key ? null : k));
          setError(res.message);
          return;
        }
        renameHighlight(root, tempId, res.id);
        setItems((list) =>
          list.map((h) => (h.key === item.key ? { ...h, id: res.id, createdAt: res.createdAt } : h)),
        );
        await flushPending(item.key, res.id);
      });
    },
    [toolbar, courseSlug, lessonSlug, openPopover, flushPending],
  );

  const patch = useCallback((key: string, change: HighlightPatch) => {
    const root = rootRef.current;
    const prev = itemsRef.current.find((h) => h.key === key);
    if (!root || !prev) return;
    const next: Item = {
      ...prev,
      ...(change.color !== undefined ? { color: change.color } : {}),
      ...(change.note !== undefined ? { note: change.note.trim() } : {}),
    };
    setItems((list) => list.map((h) => (h.key === key ? next : h)));
    restyleHighlight(root, prev.id, next.color, hasNote(next));
    setError(null);

    const id = serverId(prev);
    if (!id) {
      const queued = pending.current.get(key) ?? {};
      pending.current.set(key, { ...queued, patch: { ...queued.patch, ...change } });
      return;
    }
    startTransition(async () => {
      const res = await attempt(() => api.current.update(id, change));
      if (!res.ok) {
        setItems((list) => list.map((h) => (h.key === key ? prev : h)));
        restyleHighlight(root, prev.id, prev.color, hasNote(prev));
        setError(res.message);
      }
    });
  }, []);

  const remove = useCallback((key: string) => {
    const root = rootRef.current;
    const prev = itemsRef.current.find((h) => h.key === key);
    if (!root || !prev) return;
    removeHighlight(root, prev.id);
    setItems((list) => list.filter((h) => h.key !== key));
    setPopover((p) => (p?.key === key ? null : p));
    setEditingKey((k) => (k === key ? null : k));
    setError(null);

    const id = serverId(prev);
    if (!id) {
      pending.current.set(key, { remove: true });
      return;
    }
    startTransition(async () => {
      const res = await attempt(() => api.current.remove(id));
      if (!res.ok) {
        const pos = locateAnchor(rootText(root), prev);
        if (pos) applyHighlight(root, prev.id, pos.start, pos.end, prev.color, hasNote(prev));
        setItems((list) => sortHighlights([...list, prev]));
        setError(res.message);
      }
    });
  }, []);

  const reveal = useCallback((key: string) => {
    const root = rootRef.current;
    const item = itemsRef.current.find((h) => h.key === key);
    if (root && item) revealHighlight(root, item.id);
  }, []);

  const keyOfMark = (target: EventTarget | null): string | null => {
    const mark = target instanceof Element ? target.closest<HTMLElement>("mark[data-hl]") : null;
    const id = mark?.getAttribute("data-hl");
    if (!id) return null;
    return itemsRef.current.find((h) => h.id === id)?.key ?? null;
  };

  const onRootClick = (e: MouseEvent<HTMLDivElement>) => {
    const key = keyOfMark(e.target);
    if (!key) return;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return; // the click just finished a drag-selection
    openPopover(key);
  };

  const onRootKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const key = keyOfMark(e.target);
    if (!key) return;
    e.preventDefault();
    openPopover(key);
  };

  const current = popover ? (items.find((h) => h.key === popover.key) ?? null) : null;
  const noteCount = items.filter(hasNote).length;

  return (
    <>
      <div ref={shellRef} className="relative">
        <div className="glass-strong px-6 py-8 sm:px-10 sm:py-12">
          <div ref={rootRef} onClick={onRootClick} onKeyDown={onRootKeyDown}>
            {children}
          </div>
        </div>

        {toolbar ? (
          <div
            role="toolbar"
            aria-label="İşarələmə"
            onPointerDown={() => {
              interacting.current = true;
            }}
            onPointerUp={() => {
              window.setTimeout(() => {
                interacting.current = false;
              }, 300);
            }}
            className={`hl-pop glass-strong absolute z-30 flex -translate-x-1/2 items-center gap-1 rounded-full px-2 py-1.5 shadow-glass-wood ${
              toolbar.below ? "" : "-translate-y-full"
            }`}
            style={{ left: toolbar.left, top: toolbar.top }}
          >
            {toolbar.tooLong ? (
              <span className="px-2 text-xs text-ink/60 dark:text-white/60">
                Seçim çox uzundur; daha qısa hissə seçin.
              </span>
            ) : (
              <>
                {HIGHLIGHT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => create(c, false)}
                    aria-label={`${COLOR_LABELS[c]} ilə işarələ`}
                    title={`${COLOR_LABELS[c]} ilə işarələ`}
                    className={`hl-swatch-${c} h-7 w-7 rounded-full border border-ink/10 transition hover:scale-110 dark:border-white/20`}
                  />
                ))}
                <span aria-hidden className="mx-1 h-5 w-px bg-ink/10 dark:bg-white/15" />
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => create("yellow", true)}
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-wood transition hover:bg-brand-wood-mist dark:text-brand-brass-soft dark:hover:bg-white/10"
                >
                  <PencilIcon />
                  Qeyd
                </button>
              </>
            )}
          </div>
        ) : null}

        {popover && current ? (
          <div
            ref={popoverRef}
            role="dialog"
            aria-label="İşarələmə və qeyd"
            className={`hl-pop glass-strong absolute z-30 w-72 max-w-[calc(100vw-2rem)] -translate-x-1/2 p-3 shadow-glass-wood ${
              popover.below ? "" : "-translate-y-full"
            }`}
            style={{ left: popover.left, top: popover.top }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Rəng">
                {HIGHLIGHT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={current.color === c}
                    aria-label={COLOR_LABELS[c]}
                    title={COLOR_LABELS[c]}
                    onClick={() => patch(current.key, { color: c })}
                    className={`hl-swatch-${c} h-6 w-6 rounded-full border transition hover:scale-110 ${
                      current.color === c
                        ? "border-brand-wood ring-2 ring-brand-wood/30 dark:border-brand-brass dark:ring-brand-brass/40"
                        : "border-ink/10 dark:border-white/20"
                    }`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => setPopover(null)}
                aria-label="Bağla"
                className="rounded-md p-1 text-ink/45 transition hover:bg-ink/5 hover:text-ink dark:text-white/45 dark:hover:bg-white/10 dark:hover:text-white"
              >
                <CloseIcon />
              </button>
            </div>
            <NoteEditor
              key={popover.seq}
              note={current.note}
              autoFocus
              onSave={(note) => {
                patch(current.key, { note });
                setPopover(null);
              }}
              onCancel={() => setPopover(null)}
              onDelete={() => remove(current.key)}
            />
            {error ? <p className="mt-2 text-xs text-brand-red dark:text-red-400">{error}</p> : null}
          </div>
        ) : null}
      </div>

      <section id="qeydler" aria-labelledby="notes-heading" className="mt-12">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-brass">
              Qeyd dəftəri
            </p>
            <h2
              id="notes-heading"
              className="mt-1 text-2xl font-semibold tracking-[-0.02em] text-ink dark:text-brand-cream"
            >
              İşarələmələr və qeydlər
            </h2>
          </div>
          <p className="num text-[11px] uppercase tracking-[0.16em] text-ink/45 dark:text-white/45">
            {items.length} işarələmə · {noteCount} qeyd
          </p>
        </div>

        {items.length === 0 ? (
          <div className="glass p-6 text-sm leading-6 text-ink/55 dark:text-white/55">
            Mətndə bir hissəni seçin: rəng seçib işarələyin və ya “Qeyd” ilə fikrinizi
            yazın. İşarələmələr hesabınızda saxlanılır və dərsin PDF-inə də düşür.
          </div>
        ) : (
          <ul className="glass divide-y divide-brand-wood-ring/60 dark:divide-white/10">
            {items.map((h) => {
              const orphan = orphans.has(h.id);
              const editing = editingKey === h.key;
              return (
                <li key={h.key} className="px-5 py-4 sm:px-6">
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className={`hl-swatch-${h.color} mt-2 h-3 w-3 shrink-0 rounded-full border border-ink/10 dark:border-white/20`}
                    />
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => reveal(h.key)}
                        disabled={orphan}
                        title={orphan ? undefined : "Mətndə göstər"}
                        className="text-left text-sm leading-6 text-ink/70 transition hover:text-brand-wood disabled:cursor-default disabled:hover:text-ink/70 dark:text-white/70 dark:hover:text-brand-brass-soft dark:disabled:hover:text-white/70"
                      >
                        “{excerpt(h.exact)}”
                      </button>
                      {orphan ? (
                        <span className="chip ml-2 align-middle">Mətndə tapılmadı</span>
                      ) : null}

                      {editing ? (
                        <NoteEditor
                          note={h.note}
                          autoFocus
                          onSave={(note) => {
                            patch(h.key, { note });
                            setEditingKey(null);
                          }}
                          onCancel={() => setEditingKey(null)}
                        />
                      ) : hasNote(h) ? (
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink dark:text-brand-cream">
                          {h.note}
                        </p>
                      ) : null}

                      {!editing ? (
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-semibold uppercase tracking-[0.16em]">
                          <button
                            type="button"
                            onClick={() => setEditingKey(h.key)}
                            className="text-brand-wood transition hover:text-brand-wood-deep dark:text-brand-brass-soft dark:hover:text-brand-brass"
                          >
                            {hasNote(h) ? "Qeydi dəyiş" : "Qeyd yaz"}
                          </button>
                          {!orphan ? (
                            <button
                              type="button"
                              onClick={() => reveal(h.key)}
                              className="text-ink/45 transition hover:text-brand-wood dark:text-white/45 dark:hover:text-brand-brass-soft"
                            >
                              Mətnə keç
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => remove(h.key)}
                            className="text-ink/45 transition hover:text-brand-red dark:text-white/45 dark:hover:text-red-400"
                          >
                            Sil
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {error && !popover ? (
          <p className="mt-3 text-xs text-brand-red dark:text-red-400">{error}</p>
        ) : null}
      </section>
    </>
  );
}

function NoteEditor({
  note,
  autoFocus,
  onSave,
  onCancel,
  onDelete,
}: {
  note: string;
  autoFocus?: boolean;
  onSave: (note: string) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const id = useId();
  const [value, setValue] = useState(note);
  const dirty = value.trim() !== note.trim();

  return (
    <div className="mt-3">
      <label className="sr-only" htmlFor={id}>
        Qeyd
      </label>
      <textarea
        id={id}
        value={value}
        autoFocus={autoFocus}
        rows={3}
        maxLength={MAX_NOTE}
        placeholder="Qeyd yazın…"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            if (dirty) onSave(value);
          }
        }}
        className="field min-h-[4.5rem] resize-y text-sm leading-6"
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/45 transition hover:text-brand-red dark:text-white/45 dark:hover:text-red-400"
          >
            Sil
          </button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/55 transition hover:bg-ink/5 dark:text-white/55 dark:hover:bg-white/10"
          >
            {dirty ? "Ləğv et" : "Bağla"}
          </button>
          <button
            type="button"
            onClick={() => onSave(value)}
            disabled={!dirty}
            className="rounded-lg bg-brand-wood px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-cream transition hover:bg-brand-wood-deep disabled:opacity-40"
          >
            Yadda saxla
          </button>
        </div>
      </div>
    </div>
  );
}

function PencilIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
