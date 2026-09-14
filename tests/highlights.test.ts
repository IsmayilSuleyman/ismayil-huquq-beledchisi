import { describe, expect, it } from "vitest";
import {
  anchorFromOffsets,
  CONTEXT,
  excerpt,
  isTextAnchor,
  locateAnchor,
  MAX_EXACT,
  sliceOverNodes,
  sortHighlights,
} from "@/lib/highlights";

const TEXT =
  "Konstitusiya referendumla qəbul edildikdən sonra rəsmən dərc olunduğu gündən " +
  "qüvvəyə mindi.\nHəmin gündən 1978-ci il Konstitusiyası qüvvədən düşdü. " +
  "12 noyabr Konstitusiya Günü kimi qeyd olunur.\n" +
  "Konstitusiya Preambuladan, beş bölmədən, on iki fəsildən, 158 maddədən ibarətdir.";

describe("anchorFromOffsets", () => {
  it("stores the passage with context on both sides", () => {
    const start = TEXT.indexOf("rəsmən");
    const end = TEXT.indexOf("gündən", start) + "gündən".length;
    const a = anchorFromOffsets(TEXT, start, end);
    expect(a).not.toBeNull();
    expect(a!.exact).toBe("rəsmən dərc olunduğu gündən");
    expect(a!.start).toBe(start);
    expect(a!.end).toBe(end);
    expect(a!.prefix).toBe(TEXT.slice(start - CONTEXT, start));
    expect(a!.suffix).toBe(TEXT.slice(end, end + CONTEXT));
    expect(a!.prefix.length).toBe(CONTEXT);
  });

  it("trims whitespace off a sloppy selection and moves the offsets with it", () => {
    const start = TEXT.indexOf(" 12 noyabr") ;
    const end = TEXT.indexOf("olunur.") + "olunur.\n".length;
    const a = anchorFromOffsets(TEXT, start, end);
    expect(a!.exact).toBe("12 noyabr Konstitusiya Günü kimi qeyd olunur.");
    expect(TEXT.slice(a!.start, a!.end)).toBe(a!.exact);
  });

  it("keeps a short prefix at the start of the text", () => {
    const a = anchorFromOffsets(TEXT, 0, 12);
    expect(a!.exact).toBe("Konstitusiya");
    expect(a!.prefix).toBe("");
  });

  it("returns null for empty, whitespace-only, reversed or huge selections", () => {
    expect(anchorFromOffsets(TEXT, 5, 5)).toBeNull();
    expect(anchorFromOffsets(TEXT, TEXT.indexOf("\n"), TEXT.indexOf("\n") + 1)).toBeNull();
    expect(anchorFromOffsets(TEXT, 10, 4)).toBeNull();
    expect(anchorFromOffsets("a".repeat(MAX_EXACT + 1), 0, MAX_EXACT + 1)).toBeNull();
    expect(anchorFromOffsets(TEXT, 1.5, 4)).toBeNull();
  });
});

describe("locateAnchor", () => {
  const start = TEXT.indexOf("beş bölmədən");
  const anchor = anchorFromOffsets(TEXT, start, start + "beş bölmədən".length)!;

  it("uses the stored offsets while they still hold", () => {
    expect(locateAnchor(TEXT, anchor)).toEqual({ start, end: start + anchor.exact.length });
  });

  it("finds the passage again after text is added before it", () => {
    const shifted = "Yeni giriş cümləsi. " + TEXT;
    const pos = locateAnchor(shifted, anchor)!;
    expect(shifted.slice(pos.start, pos.end)).toBe("beş bölmədən");
    expect(pos.start).toBe(start + "Yeni giriş cümləsi. ".length);
  });

  it("picks the occurrence whose surroundings match when the passage repeats", () => {
    const first = "Qeyd: Konstitusiya 1995-ci ildə qəbul edilib. ";
    const doc = first + TEXT; // "Konstitusiya" now appears in a new sentence first
    const s = TEXT.indexOf("Konstitusiya Günü");
    const a = anchorFromOffsets(TEXT, s, s + "Konstitusiya".length)!;
    const pos = locateAnchor(doc, a)!;
    expect(doc.slice(pos.start, pos.end + " Günü".length)).toBe("Konstitusiya Günü");
  });

  it("falls back to the occurrence nearest the old offset when context is gone", () => {
    const doc = "Konstitusiya. Konstitusiya. Konstitusiya.";
    const a = { exact: "Konstitusiya", prefix: "zzz", suffix: "zzz", start: 15, end: 27 };
    expect(locateAnchor(doc, a)).toEqual({ start: 14, end: 26 });
  });

  it("returns null when the passage no longer exists", () => {
    expect(locateAnchor(TEXT.replace("beş bölmədən", "altı bölmədən"), anchor)).toBeNull();
    expect(locateAnchor(TEXT, { ...anchor, exact: "" })).toBeNull();
  });
});

describe("sliceOverNodes", () => {
  it("splits a range across the text nodes it touches", () => {
    expect(sliceOverNodes([5, 3, 10], 3, 12)).toEqual([
      { index: 0, from: 3, to: 5 },
      { index: 1, from: 0, to: 3 },
      { index: 2, from: 0, to: 4 },
    ]);
  });

  it("stays inside a single node and skips zero-length touches", () => {
    expect(sliceOverNodes([5, 3, 10], 1, 3)).toEqual([{ index: 0, from: 1, to: 3 }]);
    expect(sliceOverNodes([5, 3, 10], 5, 8)).toEqual([{ index: 1, from: 0, to: 3 }]);
    expect(sliceOverNodes([5, 0, 3], 4, 6)).toEqual([
      { index: 0, from: 4, to: 5 },
      { index: 2, from: 0, to: 1 },
    ]);
  });

  it("returns nothing for a range past the end", () => {
    expect(sliceOverNodes([5, 3], 20, 25)).toEqual([]);
  });
});

describe("isTextAnchor", () => {
  it("accepts what anchorFromOffsets produces and rejects junk", () => {
    const a = anchorFromOffsets(TEXT, 0, 12)!;
    expect(isTextAnchor(a)).toBe(true);
    expect(isTextAnchor({ ...a, exact: " " })).toBe(false);
    expect(isTextAnchor({ ...a, prefix: "x".repeat(CONTEXT + 1) })).toBe(false);
    expect(isTextAnchor({ ...a, end: a.start })).toBe(false);
    expect(isTextAnchor({ ...a, start: -1 })).toBe(false);
    expect(isTextAnchor(null)).toBe(false);
    expect(isTextAnchor("Konstitusiya")).toBe(false);
  });
});

describe("helpers", () => {
  it("excerpt collapses whitespace and cuts at a word", () => {
    expect(excerpt("a  b\n\nc")).toBe("a b c");
    const long = "söz ".repeat(100).trim();
    const cut = excerpt(long, 40);
    expect(cut.endsWith("…")).toBe(true);
    expect(cut.length).toBeLessThanOrEqual(41);
    expect(cut.slice(0, -1).endsWith(" ")).toBe(false);
  });

  it("sortHighlights orders by position, then creation time", () => {
    const list = [
      { id: "b", start: 10, createdAt: "2026-09-14T10:00:00Z" },
      { id: "a", start: 2, createdAt: "2026-09-14T11:00:00Z" },
      { id: "c", start: 10, createdAt: "2026-09-14T09:00:00Z" },
    ];
    expect(sortHighlights(list).map((h) => h.id)).toEqual(["a", "c", "b"]);
  });
});
