import path from "node:path";
import { promises as fs } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTENT_ROOT, getCourse, listCourses } from "@/lib/content";
import { getQuiz, gradeQuiz, parseQuiz, toPublicQuestions } from "@/lib/quiz";

const ROOT = path.join(__dirname, "fixtures", "courses");

describe("getQuiz", () => {
  it("reads the quiz for a lesson and marks the lesson as having one", async () => {
    const quiz = await getQuiz("test-course", "birinci", ROOT);
    expect(quiz).not.toBeNull();
    expect(quiz!.pass).toBe(50);
    expect(quiz!.questions.map((q) => q.id)).toEqual(["a", "b"]);

    const course = await getCourse("test-course", ROOT);
    expect(course!.lessons.map((l) => l.hasQuiz)).toEqual([true, false, false]);
  });

  it("returns null when there is no quiz or the slug is unsafe", async () => {
    expect(await getQuiz("test-course", "ikinci", ROOT)).toBeNull();
    expect(await getQuiz("test-course", "../birinci", ROOT)).toBeNull();
  });
});

describe("parseQuiz", () => {
  it("rejects answers that do not index an option and duplicate ids", () => {
    expect(() =>
      parseQuiz({ questions: [{ id: "x", prompt: "?", options: ["a", "b"], answer: 2 }] }, "c", "l"),
    ).toThrow(/answer/);
    expect(() =>
      parseQuiz(
        {
          questions: [
            { id: "x", prompt: "?", options: ["a", "b"], answer: 0 },
            { id: "x", prompt: "?", options: ["a", "b"], answer: 1 },
          ],
        },
        "c",
        "l",
      ),
    ).toThrow(/duplicate/);
  });

  it("defaults the pass mark to 70", () => {
    const quiz = parseQuiz({ questions: [{ id: "x", prompt: "?", options: ["a", "b"], answer: 0 }] }, "c", "l");
    expect(quiz.pass).toBe(70);
  });
});

describe("gradeQuiz", () => {
  it("scores, applies the pass mark and never leaks answers to the page", async () => {
    const quiz = (await getQuiz("test-course", "birinci", ROOT))!;
    const pub = toPublicQuestions(quiz);
    expect(Object.keys(pub[0])).toEqual(["id", "prompt", "options"]);

    const half = gradeQuiz(quiz, { a: 1, b: 2 });
    expect(half.score).toBe(1);
    expect(half.percent).toBe(50);
    expect(half.passed).toBe(true);
    expect(half.results[1]).toMatchObject({ given: 2, correct: 0, isCorrect: false });

    const none = gradeQuiz(quiz, { a: 9, b: -1 });
    expect(none.score).toBe(0);
    expect(none.results.map((r) => r.given)).toEqual([null, null]);
    expect(none.passed).toBe(false);
  });
});

describe("real quizzes", () => {
  it("every quiz file in content/ is valid and belongs to a lesson", async () => {
    const courses = await listCourses(CONTENT_ROOT);
    expect(courses.length).toBeGreaterThan(0);
    for (const course of courses) {
      const dir = path.join(CONTENT_ROOT, course.slug, "quizzes");
      let files: string[] = [];
      try {
        files = await fs.readdir(dir);
      } catch {
        continue;
      }
      for (const file of files) {
        const slug = file.replace(/\.json$/, "");
        expect(course.lessons.some((l) => l.slug === slug), `${course.slug}/${file} has no lesson`).toBe(true);
        const quiz = await getQuiz(course.slug, slug, CONTENT_ROOT);
        expect(quiz).not.toBeNull();
        for (const q of quiz!.questions) {
          expect(q.explanation, `${course.slug}/${slug}#${q.id} needs an explanation`).not.toBe("");
          expect(new Set(q.options).size).toBe(q.options.length);
        }
      }
    }
  });
});
