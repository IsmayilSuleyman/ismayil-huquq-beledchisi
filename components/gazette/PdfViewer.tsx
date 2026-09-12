"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Document, Page, Thumbnail, pdfjs } from "react-pdf";
import type { PDFDocumentProxy } from "pdfjs-dist";
import DownloadButton from "@/components/gazette/DownloadButton";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 4;

type Props = {
  fileUrl: string;
  issueId: string;
  issueNumber: number;
};

function ToolButton({
  onClick,
  title,
  active = false,
  disabled = false,
  children,
}: {
  onClick?: () => void;
  title: string;
  active?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      disabled={disabled}
      className={`inline-flex items-center justify-center w-[2.125rem] h-[2.125rem] min-w-8 rounded-lg border text-foreground/85 transition-colors disabled:opacity-35 disabled:cursor-not-allowed ${
        active
          ? "bg-omni/70 border-azure/50 text-white"
          : "bg-white/5 border-white/10 hover:bg-white/[0.12] hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default function PdfViewer({ fileUrl, issueId, issueNumber }: Props) {
  const shellRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<PDFDocumentProxy | null>(null);
  const pageWrappers = useRef<Map<number, HTMLDivElement>>(new Map());
  const pageDims = useRef<Map<number, { w: number; h: number }>>(new Map());
  const textCache = useRef<Map<number, string>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);

  const [numPages, setNumPages] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [containerSize, setContainerSize] = useState({ w: 900, h: 700 });
  const [firstAspect, setFirstAspect] = useState(1.4142);
  const [mode, setMode] = useState<"width" | "page" | "custom">("width");
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [visible, setVisible] = useState<Set<number>>(() => new Set([1, 2]));
  const [thumbsOpen, setThumbsOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searchText, setSearchText] = useState("");
  const [searching, setSearching] = useState(false);
  const [matchPages, setMatchPages] = useState<number[]>([]);
  const [matchTotal, setMatchTotal] = useState(0);
  const [activeMatch, setActiveMatch] = useState(0);
  const [pinchScale, setPinchScale] = useState(1);
  const pinchRef = useRef<{ startDist: number; startZoom: number; scale: number } | null>(null);
  const effectiveZoomRef = useRef(1);

  /* ---------- measurements ----------
     Runs again once the document is ready (numPages > 0): react-pdf shows a
     loading state first, so the scroll container only exists after load. */
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setContainerSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [numPages]);

  const aspectOf = useCallback(
    (n: number) => {
      const d = pageDims.current.get(n);
      let a = d ? d.h / d.w : firstAspect;
      if (rotation % 180 !== 0) a = 1 / a;
      return a;
    },
    [firstAspect, rotation]
  );

  const fitWidthW = Math.max(180, containerSize.w - 44);
  const fitPageW = Math.max(
    180,
    Math.min(fitWidthW, Math.floor((containerSize.h - 40) / aspectOf(currentPage)))
  );
  const pageWidth =
    mode === "width"
      ? fitWidthW
      : mode === "page"
        ? fitPageW
        : Math.round(fitWidthW * zoom);
  const zoomPercent = Math.round((pageWidth / fitWidthW) * 100);
  effectiveZoomRef.current = pageWidth / fitWidthW;

  function zoomBy(factor: number) {
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, (pageWidth / fitWidthW) * factor));
    setMode("custom");
    setZoom(next);
  }

  /* ---------- lazy page rendering ---------- */
  useEffect(() => {
    if (!numPages) return;
    observerRef.current?.disconnect();
    const io = new IntersectionObserver(
      (entries) => {
        setVisible((prev) => {
          const next = new Set(prev);
          for (const e of entries) {
            const n = Number((e.target as HTMLElement).dataset.page);
            if (e.isIntersecting) next.add(n);
            else next.delete(n);
          }
          return next;
        });
      },
      { root: scrollRef.current, rootMargin: "1400px 0px" }
    );
    observerRef.current = io;
    pageWrappers.current.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [numPages]);

  const registerWrapper = useCallback((n: number, el: HTMLDivElement | null) => {
    const map = pageWrappers.current;
    const prev = map.get(n);
    if (prev && observerRef.current) observerRef.current.unobserve(prev);
    if (el) {
      map.set(n, el);
      observerRef.current?.observe(el);
    } else {
      map.delete(n);
    }
  }, []);

  /* ---------- current page tracking ---------- */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const probe = el.scrollTop + el.clientHeight * 0.38;
        let best = 1;
        pageWrappers.current.forEach((wrap, n) => {
          if (wrap.offsetTop <= probe) best = Math.max(best, n);
        });
        setCurrentPage((p) => (p === best ? p : best));
        setPageInput((v) => (Number(v) === best ? v : String(best)));
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [numPages]);

  const scrollToPage = useCallback((n: number, smooth = true) => {
    const wrap = pageWrappers.current.get(n);
    const el = scrollRef.current;
    if (!wrap || !el) return;
    el.scrollTo({ top: wrap.offsetTop - 10, behavior: smooth ? "smooth" : "auto" });
  }, []);

  /* keep position when zoom / rotation changes */
  const lastLayout = useRef({ pageWidth, rotation });
  useEffect(() => {
    const prev = lastLayout.current;
    if (prev.pageWidth === pageWidth && prev.rotation === rotation) return;
    lastLayout.current = { pageWidth, rotation };
    const el = scrollRef.current;
    if (prev.rotation !== rotation) {
      requestAnimationFrame(() => scrollToPage(currentPage, false));
    } else if (el && prev.pageWidth > 0) {
      // page heights scale linearly with width — keep the same content in view
      const ratio = pageWidth / prev.pageWidth;
      const top = el.scrollTop * ratio;
      requestAnimationFrame(() => {
        el.scrollTop = top;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageWidth, rotation]);

  /* ---------- two-finger pinch zoom ----------
     During the gesture we scale with a cheap CSS transform; on release the
     final zoom is committed and pdf.js re-renders sharply at the new width. */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const dist = (t: TouchList) =>
      Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      e.preventDefault();
      pinchRef.current = {
        startDist: dist(e.touches),
        startZoom: effectiveZoomRef.current,
        scale: 1,
      };
    };
    const onMove = (e: TouchEvent) => {
      const p = pinchRef.current;
      if (!p || e.touches.length !== 2) return;
      e.preventDefault();
      const raw = dist(e.touches) / p.startDist;
      const clamped = Math.min(
        MAX_ZOOM / p.startZoom,
        Math.max(MIN_ZOOM / p.startZoom, raw)
      );
      p.scale = clamped;
      setPinchScale(clamped);
    };
    const onEnd = () => {
      const p = pinchRef.current;
      if (!p) return;
      pinchRef.current = null;
      setPinchScale(1);
      if (Math.abs(p.scale - 1) > 0.01) {
        setMode("custom");
        setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, p.startZoom * p.scale)));
      }
    };
    el.addEventListener("touchstart", onStart, { passive: false });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [numPages]);

  /* ---------- fullscreen ---------- */
  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void shellRef.current?.requestFullscreen();
  }

  /* ---------- search ---------- */
  async function runSearch(raw: string) {
    const q = raw.trim();
    setSearchText(q);
    setMatchPages([]);
    setMatchTotal(0);
    setActiveMatch(0);
    const pdf = pdfRef.current;
    if (!q || !pdf) return;
    setSearching(true);
    try {
      const needle = q.toLowerCase();
      const pages: number[] = [];
      let total = 0;
      for (let p = 1; p <= pdf.numPages; p++) {
        let text = textCache.current.get(p);
        if (text === undefined) {
          const page = await pdf.getPage(p);
          const tc = await page.getTextContent();
          text = tc.items
            .map((it) => ("str" in it ? it.str : ""))
            .join(" ");
          textCache.current.set(p, text);
        }
        const lower = text.toLowerCase();
        let idx = 0;
        let count = 0;
        while ((idx = lower.indexOf(needle, idx)) !== -1) {
          count++;
          idx += Math.max(1, needle.length);
        }
        if (count > 0) {
          pages.push(p);
          total += count;
        }
      }
      setMatchPages(pages);
      setMatchTotal(total);
      if (pages.length) {
        setActiveMatch(0);
        scrollToPage(pages[0]);
      }
    } finally {
      setSearching(false);
    }
  }

  function stepMatch(dir: 1 | -1) {
    if (!matchPages.length) return;
    const next = (activeMatch + dir + matchPages.length) % matchPages.length;
    setActiveMatch(next);
    scrollToPage(matchPages[next]);
  }

  const highlighter = useMemo(() => {
    if (!searchText) return undefined;
    const re = new RegExp(escapeRegExp(searchText), "gi");
    return ({ str }: { str: string }) =>
      str.replace(re, (m) => `<mark>${m}</mark>`);
  }, [searchText]);

  /* ---------- keyboard shortcuts ---------- */
  function onKeyDown(e: React.KeyboardEvent) {
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
    if (e.key === "ArrowRight" || e.key === "PageDown") {
      e.preventDefault();
      scrollToPage(Math.min(numPages, currentPage + 1));
    } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
      e.preventDefault();
      scrollToPage(Math.max(1, currentPage - 1));
    } else if (e.key === "+" || e.key === "=") {
      zoomBy(1.2);
    } else if (e.key === "-") {
      zoomBy(1 / 1.2);
    }
  }

  function commitPageInput() {
    const n = Math.min(numPages || 1, Math.max(1, Number(pageInput) || 1));
    setPageInput(String(n));
    scrollToPage(n);
  }

  const placeholderH = (n: number) => Math.round(pageWidth * aspectOf(n));

  /* ---------- render ---------- */
  return (
    <div
      ref={shellRef}
      onKeyDown={onKeyDown}
      tabIndex={0}
      className="olg-pdf-shell olg-glass-deep rounded-2xl overflow-hidden flex flex-col h-[82vh] min-h-[480px] outline-none focus-visible:ring-2 focus-visible:ring-azure/40"
    >
      {/* Toolbar */}
      <div className="flex items-center justify-center sm:justify-start gap-1.5 flex-wrap px-2.5 sm:px-3 py-2 sm:py-2.5 border-b olg-hairline bg-white/[0.04] backdrop-blur-xl z-10">
        <ToolButton
          title={thumbsOpen ? "Hide thumbnails" : "Show thumbnails"}
          onClick={() => setThumbsOpen((v) => !v)}
          active={thumbsOpen}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <rect x="3" y="3" width="7" height="9" rx="1.5" stroke="currentColor" strokeWidth="2" />
            <rect x="14" y="3" width="7" height="9" rx="1.5" stroke="currentColor" strokeWidth="2" />
            <rect x="3" y="16" width="7" height="5" rx="1.5" stroke="currentColor" strokeWidth="2" />
            <rect x="14" y="16" width="7" height="5" rx="1.5" stroke="currentColor" strokeWidth="2" />
          </svg>
        </ToolButton>

        <div className="flex items-center gap-1 ml-1 text-sm">
          <input
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ""))}
            onBlur={commitPageInput}
            onKeyDown={(e) => e.key === "Enter" && commitPageInput()}
            inputMode="numeric"
            aria-label="Page number"
            className="olg-field !w-12 text-center !py-1.5 !px-1 !rounded-md text-sm"
          />
          <span className="text-silver text-xs whitespace-nowrap">/ {numPages || "–"}</span>
        </div>

        <span className="w-px h-5 bg-white/[0.12] mx-1 hidden sm:block" aria-hidden />

        <ToolButton title="Zoom out (-)" onClick={() => zoomBy(1 / 1.2)} disabled={!numPages}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </ToolButton>
        <span className="text-xs text-silver w-11 text-center tabular-nums">{zoomPercent}%</span>
        <ToolButton title="Zoom in (+)" onClick={() => zoomBy(1.2)} disabled={!numPages}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </ToolButton>
        <ToolButton title="Fit width" onClick={() => setMode("width")} active={mode === "width"}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M3 12h18M3 12l4-4m-4 4 4 4m14-4-4-4m4 4-4 4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </ToolButton>
        <ToolButton title="Fit page" onClick={() => setMode("page")} active={mode === "page"}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <rect x="5" y="3.5" width="14" height="17" rx="2" stroke="currentColor" strokeWidth="1.9" />
          </svg>
        </ToolButton>
        <ToolButton title="Rotate" onClick={() => setRotation((r) => (r + 90) % 360)} disabled={!numPages}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M20 8a8 8 0 1 0 2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M21 3v5h-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </ToolButton>

        {/* Search cluster */}
        <div className="flex items-center gap-1.5 ml-auto">
          {searchOpen && (
            <div className="flex items-center gap-1.5">
              <input
                autoFocus
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void runSearch(searchInput);
                  if (e.key === "Escape") {
                    setSearchOpen(false);
                    setSearchInput("");
                    void runSearch("");
                  }
                }}
                placeholder="Search in document…"
                aria-label="Search in document"
                className="olg-field !w-36 sm:!w-52 !py-1.5 !px-3 !rounded-md text-sm"
              />
              {searching ? (
                <span className="text-[0.68rem] text-silver animate-pulse whitespace-nowrap">searching…</span>
              ) : searchText ? (
                <span className="text-[0.68rem] text-silver whitespace-nowrap tabular-nums">
                  {matchTotal
                    ? `${matchTotal} hit${matchTotal === 1 ? "" : "s"} · p.${matchPages[activeMatch]}`
                    : "no matches"}
                </span>
              ) : null}
              <ToolButton title="Previous match" onClick={() => stepMatch(-1)} disabled={!matchPages.length}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="m6 14 6-6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </ToolButton>
              <ToolButton title="Next match" onClick={() => stepMatch(1)} disabled={!matchPages.length}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="m6 10 6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </ToolButton>
            </div>
          )}
          <ToolButton
            title={searchOpen ? "Close search" : "Search in document"}
            active={searchOpen}
            onClick={() => {
              if (searchOpen) {
                setSearchOpen(false);
                setSearchInput("");
                void runSearch("");
              } else setSearchOpen(true);
            }}
            disabled={!numPages}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <path d="m20 20-3.2-3.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </ToolButton>

          <span className="w-px h-5 bg-white/[0.12] mx-0.5 hidden sm:block" aria-hidden />

          <a
            href={fileUrl}
            target="_blank"
            rel="noreferrer"
            title="Open raw PDF in new tab"
            aria-label="Open raw PDF in new tab"
            className="hidden sm:inline-flex items-center justify-center w-[2.125rem] h-[2.125rem] rounded-lg border bg-white/5 border-white/10 text-foreground/85 hover:bg-white/[0.12] hover:text-white transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M14 4h6v6M20 4l-9 9M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
          <ToolButton title={fullscreen ? "Exit fullscreen" : "Fullscreen"} onClick={toggleFullscreen} active={fullscreen}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M4 9V4h5M20 9V4h-5M4 15v5h5m11-5v5h-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </ToolButton>
          <DownloadButton issueId={issueId} issueNumber={issueNumber} pdfUrl={fileUrl} variant="icon" className="!w-[2.125rem] !h-[2.125rem]" />
        </div>
      </div>

      {/* Body */}
      <Document
        file={fileUrl}
        onLoadSuccess={(pdf) => {
          pdfRef.current = pdf;
          setNumPages(pdf.numPages);
          setLoadError(null);
          void pdf.getPage(1).then((page) => {
            const vp = page.getViewport({ scale: 1 });
            pageDims.current.set(1, { w: vp.width, h: vp.height });
            setFirstAspect(vp.height / vp.width);
          });
        }}
        onLoadError={(err) => setLoadError(err.message)}
        onItemClick={({ pageNumber }) => pageNumber && scrollToPage(Number(pageNumber))}
        loading={
          <div className="flex-1 grid place-items-center p-10 min-h-0">
            <div className="w-full max-w-xl">
              <div className="olg-skeleton rounded-xl w-full aspect-[1/1.2]" />
              <p className="text-center text-xs text-silver mt-4 animate-pulse">
                Preparing the reading room…
              </p>
            </div>
          </div>
        }
        error={
          <div className="flex-1 grid place-items-center p-10">
            <div className="text-center max-w-sm">
              <p className="font-serif text-xl mb-2">Couldn’t open this issue.</p>
              <p className="text-sm text-silver mb-5">{loadError ?? "The PDF failed to load."}</p>
              <a className="olg-btn olg-btn-ghost" href={fileUrl} target="_blank" rel="noreferrer">
                Open the raw PDF instead
              </a>
            </div>
          </div>
        }
        className="flex flex-1 min-h-0 min-w-0"
      >
        {thumbsOpen && numPages > 0 && (
          <aside className="w-[104px] sm:w-[148px] shrink-0 overflow-y-auto border-r olg-hairline p-2 sm:p-3 space-y-2 sm:space-y-3 bg-black/25">
            {Array.from({ length: numPages }, (_, i) => i + 1).map((n) => (
              <div
                key={`thumb-${n}`}
                className={`olg-pdf-thumb relative cursor-pointer rounded-md overflow-hidden ring-offset-0 transition-shadow ${
                  currentPage === n ? "ring-2 ring-azure" : "ring-1 ring-white/10 hover:ring-azure/50"
                }`}
              >
                <Thumbnail
                  pageNumber={n}
                  width={120}
                  loading={<div className="olg-skeleton w-full aspect-[1/1.3]" />}
                />
                <span
                  className={`absolute bottom-1 right-1 text-[0.6rem] px-1.5 py-0.5 rounded backdrop-blur-sm ${
                    currentPage === n ? "bg-omni text-white" : "bg-black/55 text-white/80"
                  }`}
                >
                  {n}
                </span>
              </div>
            ))}
          </aside>
        )}

        <div
          ref={scrollRef}
          className="flex-1 min-w-0 overflow-auto overscroll-contain px-3 sm:px-5 py-4 sm:py-5 [touch-action:pan-x_pan-y]"
        >
          <div
            className="flex flex-col items-center gap-4 sm:gap-5 origin-top"
            style={pinchScale !== 1 ? { transform: `scale(${pinchScale})` } : undefined}
          >
            {Array.from({ length: numPages }, (_, i) => i + 1).map((n) => (
              <div
                key={`page-${n}`}
                data-page={n}
                ref={(el) => registerWrapper(n, el)}
                style={{ width: pageWidth, minHeight: visible.has(n) ? undefined : placeholderH(n) }}
              >
                {visible.has(n) ? (
                  <Page
                    pageNumber={n}
                    width={pageWidth}
                    rotate={rotation}
                    renderAnnotationLayer
                    renderTextLayer
                    customTextRenderer={highlighter}
                    onLoadSuccess={(page) => {
                      pageDims.current.set(n, {
                        w: page.originalWidth,
                        h: page.originalHeight,
                      });
                    }}
                    loading={
                      <div className="olg-skeleton rounded-md" style={{ width: pageWidth, height: placeholderH(n) }} />
                    }
                  />
                ) : (
                  <div className="olg-skeleton rounded-md w-full h-full" style={{ minHeight: placeholderH(n) }} />
                )}
              </div>
            ))}
          </div>
        </div>
      </Document>
    </div>
  );
}
