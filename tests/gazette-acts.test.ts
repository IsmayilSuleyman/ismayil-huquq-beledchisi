import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  actLabel,
  averageStars,
  classifyAct,
  onBoard,
  pickBoard,
  ratedOff,
  sortForBoard,
  sourceHost,
  windowStart,
} from "@/lib/gazette/acts";
import { actRows } from "@/scripts/gazette/acts";
import { checkDraft } from "@/scripts/gazette/draft";

const FIXTURE = path.join(import.meta.dirname, "fixtures", "gazette", "draft.json");

function fixture() {
  const result = checkDraft(JSON.parse(readFileSync(FIXTURE, "utf8")));
  if (!result.ok) throw new Error(result.errors.join("; "));
  return result.draft;
}

describe("classifyAct", () => {
  it("puts every Constitutional Court ruling on the board", () => {
    const c = classifyAct({ section: "court", text: "Ailə Məcəlləsinin 47.1-ci maddəsi şərh edilib." });
    expect(c.important).toBe(true);
    expect(c.topics).toEqual(["court", "civil"]);
  });

  it("recognises the codes the firm follows, in any casing", () => {
    const cases: [string, string[]][] = [
      ["Cinayət Məcəlləsində və Cinayət-Prosessual Məcəllədə dəyişiklik (hüquqi şəxslərə cinayət-hüquqi tədbirlərin tətbiqi).", ["criminal"]],
      ["Mülki Məcəllədə və “İcra haqqında” Qanunda dəyişiklik (məhsul şəhadətnaməsi).", ["civil"]],
      ["Vergi Məcəlləsində, “Hərbi qulluqçuların statusu haqqında” Qanunda dəyişiklik.", ["tax"]],
      ["“Mərkəzi Bank haqqında” Qanunda dəyişiklik (cinayət yolu ilə əldə edilmiş əmlakın leqallaşdırılmasına qarşı mübarizə üzrə nəzarət).", ["banking"]],
      ["“Banklar haqqında” və “Qiymətli kağızlar bazarı haqqında” qanunlarda dəyişiklik (sekyuritizasiya).", ["banking"]],
      ["“Dövlət satınalmaları haqqında” Qanunda dəyişiklik.", ["corporate"]],
      ["İNZİBATİ XƏTALAR MƏCƏLLƏSİNİN 262-ci maddəsi şərh edilib.", ["administrative"]],
      ["Elektron ticarəti həyata keçirən qeyri-rezidentlərin vergi uçotu və ƏDV Qaydasında dəyişiklik edilib.", ["tax"]],
    ];
    for (const [text, topics] of cases) {
      const c = classifyAct({ section: "bills", text });
      expect(c.topics, text).toEqual(topics);
      expect(c.important, text).toBe(true);
    }
  });

  it("keeps diplomatic, labour and administrative housekeeping off the board", () => {
    const off = [
      "Qırğız Respublikası ilə cinayətkarlıqla mübarizə sahəsində əməkdaşlıq haqqında hökumətlərarası Saziş təsdiq edilib.",
      "“Əmək pensiyaları haqqında”, “Diplomatik xidmət haqqında” və digər qanunlarda dəyişiklik (aylıq pensiya əlavəsi).",
      "700 nömrəli Fərmanın icrası ilə əlaqədar publik hüquqi şəxslərin yenidən təşkili ilə bağlı 28 fərman və sərəncamda dəyişiklik edilib.",
      "Ağdam rayonunun Xıdırlı kənd tam orta ümumtəhsil məktəbinə Ayköl Manasın adı verilib.",
      "Müraciətin Dövlət Vergi Xidmətinə göndərilməsi qaydası dəyişdirilib.",
      "Vahid büdcə təsnifatının tərkibində büdcə xərclərinin funksional və inzibati təsnifatı yeni redaksiyada verilib.",
    ];
    for (const text of off) {
      expect(classifyAct({ section: "decisions", text }).important, text).toBe(false);
    }
    expect(classifyAct({ section: "decrees", text: off[0] }).topics).toEqual(["diplomatic"]);
    expect(classifyAct({ section: "bills", text: off[1] }).topics).toEqual(["labour", "diplomatic"]);
  });

  it("lets the draft override the rule either way", () => {
    expect(classifyAct({ section: "decrees", text: "Saziş təsdiq edilib." }, true).important).toBe(true);
    expect(classifyAct({ section: "court", text: "Qərardad." }, false).important).toBe(false);
  });
});

describe("actRows", () => {
  it("numbers the fixture's acts in print order and carries the draft's fields", () => {
    const rows = actRows(fixture(), 18);
    expect(rows.map((r) => r.position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(rows.every((r) => r.issue_number === 18)).toBe(true);
    expect(rows[0]).toMatchObject({ section: "decrees", number: "804", stage: null, ruling: null });
    expect(rows[4]).toMatchObject({ section: "bills", number: null, stage: "III", important: true });
    expect(rows[6]).toMatchObject({ section: "court", ruling: "qərardad", important: true });
    expect(rows.filter((r) => r.important).map((r) => r.position)).toEqual([5, 7, 8]);
  });

  it("accepts an important flag in the draft", () => {
    const raw = JSON.parse(readFileSync(FIXTURE, "utf8"));
    raw.sections.decrees.entries[0].important = true;
    raw.sections.decrees.entries[1].important = "yes";
    const result = checkDraft(raw);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual(["sections.decrees.entries[1].important must be true or false"]);
  });
});

describe("board helpers", () => {
  it("labels a sticker by its section", () => {
    expect(actLabel({ section: "decrees", number: "807", stage: null, ruling: null })).toBe("Decree № 807");
    expect(actLabel({ section: "decisions", number: null, stage: null, ruling: null })).toBe("Cabinet decision");
    expect(actLabel({ section: "bills", number: null, stage: "II", ruling: null })).toBe("Bill · 2nd reading");
    expect(actLabel({ section: "court", number: null, stage: null, ruling: "qərardad" })).toBe("Court · procedural ruling");
  });

  it("names the source's site", () => {
    expect(sourceHost("https://www.e-qanun.az/framework/62764")).toBe("e-qanun.az");
    expect(sourceHost("not a url")).toBe("not a url");
  });

  it("opens the window 30 days back, across a month boundary", () => {
    expect(windowStart(new Date("2026-10-30T15:00:00Z"), 30)).toBe("2026-09-30");
    expect(windowStart(new Date("2026-03-01T00:00:00Z"), 30)).toBe("2026-01-30");
  });

  it("sorts newest first, the court ahead of the rest on a day", () => {
    const sorted = sortForBoard([
      { date: "2026-10-19", section: "decrees", issue_number: 18, position: 1 },
      { date: "2026-10-23", section: "bills", issue_number: 18, position: 6 },
      { date: "2026-10-19", section: "court", issue_number: 18, position: 7 },
      { date: "2026-10-23", section: "decisions", issue_number: 18, position: 3 },
    ]);
    expect(sorted.map((a) => `${a.date} ${a.section}`)).toEqual([
      "2026-10-23 decisions",
      "2026-10-23 bills",
      "2026-10-19 court",
      "2026-10-19 decrees",
    ]);
  });
});

describe("ratings and the picks", () => {
  const base = { important: true, section: "bills" as const, issue_number: 18, position: 1, rating_count: 0, rating_sum: 0 };

  it("averages the stars, or has no average before the first vote", () => {
    expect(averageStars({ rating_count: 0, rating_sum: 0 })).toBeNull();
    expect(averageStars({ rating_count: 4, rating_sum: 14 })).toBe(3.5);
  });

  it("takes an act off the board once two readers average under three stars", () => {
    expect(ratedOff({ rating_count: 1, rating_sum: 1 })).toBe(false);
    expect(ratedOff({ rating_count: 2, rating_sum: 5 })).toBe(true);
    expect(ratedOff({ rating_count: 2, rating_sum: 6 })).toBe(false);
    expect(ratedOff({ rating_count: 3, rating_sum: 8 })).toBe(true);
    expect(onBoard({ important: true, rating_count: 2, rating_sum: 5 })).toBe(false);
    expect(onBoard({ important: false, rating_count: 5, rating_sum: 25 })).toBe(false);
    expect(onBoard({ important: true, rating_count: 0, rating_sum: 0 })).toBe(true);
  });

  it("picks at most twelve, the best rated first, then the newest; unrated acts count as neutral", () => {
    const acts = Array.from({ length: 15 }, (_, i) => ({
      ...base,
      id: `a${i}`,
      date: `2026-10-${String(1 + i).padStart(2, "0")}`,
      position: i + 1,
    }));
    acts[0] = { ...acts[0], rating_count: 1, rating_sum: 5 }; // oldest, but rated 5: first
    acts[1] = { ...acts[1], rating_count: 1, rating_sum: 2 }; // rated 2 by one reader: still eligible, last
    acts[2] = { ...acts[2], rating_count: 2, rating_sum: 4 }; // voted off
    acts[3] = { ...acts[3], important: false }; // never eligible
    const picks = pickBoard(acts);
    expect(picks).toHaveLength(12);
    expect(picks[0].id).toBe("a0");
    expect(picks.map((a) => a.id)).not.toContain("a2");
    expect(picks.map((a) => a.id)).not.toContain("a3");
    expect(picks.map((a) => a.id)).not.toContain("a1");
    expect(picks.slice(1).map((a) => a.id)).toEqual(["a14", "a13", "a12", "a11", "a10", "a9", "a8", "a7", "a6", "a5", "a4"]);
    expect(pickBoard(acts, 3).map((a) => a.id)).toEqual(["a0", "a14", "a13"]);
  });
});
