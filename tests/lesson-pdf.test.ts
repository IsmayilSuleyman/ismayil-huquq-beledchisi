import { describe, expect, it } from "vitest";
import type { LessonPage } from "@/lib/content";
import { parseLessonBody, renderLessonPdf } from "@/lib/pdf/lesson-pdf";

const BODY = `## Konstitusiyanın quruluşu

Konstitusiya **Preambuladan**, beş bölmədən, on iki fəsildən və *158 maddədən* ibarətdir.
Rəsmi mətn: [e-qanun.az](https://e-qanun.az/framework/897).

> Konstitusiyanın mətni yalnız referendumla dəyişdirilə bilər (152-ci maddə).

### Üç referendum

1. 2002-ci il — 24 maddəyə dəyişiklik
2. 2009-cu il — 29 maddəyə dəyişiklik
3. 2016-cı il — 23 maddəyə dəyişiklik, 6 yeni maddə

- Əsas hüquqlar
- Vəzifələr
  - Vergilər
  - Hərbi xidmət

| Bölmə | Fəsillər | Maddələr |
| --- | --- | --- |
| I | 1–2 | 1–23 |
| II | 3 | 24–80 |

---

Son abzas: ə ı ş ğ ç ö ü İ, «sitat», “sitat”, № 5, § 3.
`;

function fakePage(body: string): LessonPage {
  const lesson = {
    slug: "preambula-ve-qurulus",
    courseSlug: "konstitusiya",
    title: "Preambula və Konstitusiyanın quruluşu",
    summary: "Konstitusiyanın quruluşu, keçid müddəaları və üç referendum.",
    order: 2,
    minutes: 14,
    hasQuiz: true,
  };
  return {
    course: {
      slug: "konstitusiya",
      title: "Azərbaycan Respublikasının Konstitusiyası",
      description: "Konstitusiya dərsliyi",
      order: 1,
      level: "Giriş",
      lessons: [{ ...lesson, slug: "giris", title: "Giriş", order: 1 }, lesson],
    },
    lesson: { ...lesson, body },
    prev: null,
    next: null,
  };
}

describe("lesson PDF", () => {
  it("parses GitHub-flavoured Markdown into blocks", () => {
    const types = parseLessonBody(BODY).map((n) => n.type);
    expect(types).toEqual([
      "heading",
      "paragraph",
      "blockquote",
      "heading",
      "list",
      "list",
      "table",
      "thematicBreak",
      "paragraph",
    ]);
  });

  it("renders a lesson with highlights to a PDF", async () => {
    const pdf = await renderLessonPdf({
      page: fakePage(BODY),
      highlights: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          exact: "Konstitusiyanın mətni yalnız referendumla dəyişdirilə bilər",
          prefix: "",
          suffix: " (152-ci maddə).",
          start: 10,
          end: 70,
          color: "yellow",
          note: "İmtahan üçün vacib: 152-ci maddə.",
          createdAt: "2026-09-14T10:00:00Z",
        },
        {
          id: "22222222-2222-4222-8222-222222222222",
          exact: "beş bölmədən",
          prefix: "Preambuladan, ",
          suffix: ", on iki",
          start: 40,
          end: 52,
          color: "blue",
          note: "",
          createdAt: "2026-09-14T10:01:00Z",
        },
      ],
      host: "ismayilhuquqbeledchisi.vercel.app",
      readerName: "İsmayıl Süleyman",
      date: new Date("2026-09-14T12:00:00Z"),
    });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    // Four embedded font subsets plus text: comfortably bigger than an empty page.
    expect(pdf.length).toBeGreaterThan(20_000);
    expect(pdf.toString("latin1")).toContain("/Type /Page");
  }, 30_000);

  it("copes with a body that is only plain text and no highlights", async () => {
    const pdf = await renderLessonPdf({
      page: fakePage("Sadə mətn."),
      highlights: [],
      host: "localhost:3000",
      readerName: null,
    });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  }, 30_000);
});
