import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  getCourse,
  getLesson,
  isSlug,
  lessonSlugFromFile,
  listCourses,
} from "@/lib/content";

const ROOT = path.join(__dirname, "fixtures", "courses");

describe("lessonSlugFromFile", () => {
  it("strips the numeric ordering prefix", () => {
    expect(lessonSlugFromFile("01-huquq-anlayisi.mdx")).toEqual({
      slug: "huquq-anlayisi",
      order: 1,
    });
  });

  it("accepts files without a prefix and rejects non-mdx files", () => {
    expect(lessonSlugFromFile("giris.mdx")).toEqual({ slug: "giris", order: null });
    expect(lessonSlugFromFile("notes.txt")).toBeNull();
    expect(lessonSlugFromFile("Bad Name.mdx")).toBeNull();
  });
});

describe("isSlug", () => {
  it("only allows lowercase url-safe slugs", () => {
    expect(isSlug("huququn-esaslari")).toBe(true);
    expect(isSlug("../etc")).toBe(false);
    expect(isSlug("Hüquq")).toBe(false);
    expect(isSlug("")).toBe(false);
  });
});

describe("listCourses / getCourse", () => {
  it("lists only folders that carry a course.json", async () => {
    const courses = await listCourses(ROOT);
    expect(courses.map((c) => c.slug)).toEqual(["test-course"]);
    expect(courses[0].title).toBe("Test kursu");
    expect(courses[0].level).toBe("Başlanğıc");
  });

  it("orders lessons by frontmatter order, then file prefix, and drops junk", async () => {
    const course = await getCourse("test-course", ROOT);
    expect(course).not.toBeNull();
    expect(course!.lessons.map((l) => l.slug)).toEqual(["birinci", "ikinci", "ucuncu"]);
    expect(course!.lessons.map((l) => l.order)).toEqual([1, 2, 3]);
    expect(course!.lessons[1].minutes).toBe(8);
    expect(course!.lessons[0].minutes).toBeNull();
  });

  it("returns null for unknown or unsafe course slugs", async () => {
    expect(await getCourse("nope", ROOT)).toBeNull();
    expect(await getCourse("../test-course", ROOT)).toBeNull();
  });

  it("returns an empty list when the content root is missing", async () => {
    expect(await listCourses(path.join(ROOT, "missing"))).toEqual([]);
  });
});

describe("getLesson", () => {
  it("returns the body without frontmatter plus prev/next neighbours", async () => {
    const page = await getLesson("test-course", "ikinci", ROOT);
    expect(page).not.toBeNull();
    expect(page!.lesson.title).toBe("İkinci dərs");
    expect(page!.lesson.body.trim()).toBe("İkinci dərsin mətni.");
    expect(page!.lesson.body).not.toContain("summary:");
    expect(page!.prev?.slug).toBe("birinci");
    expect(page!.next?.slug).toBe("ucuncu");
  });

  it("has no prev on the first lesson and no next on the last", async () => {
    const first = await getLesson("test-course", "birinci", ROOT);
    const last = await getLesson("test-course", "ucuncu", ROOT);
    expect(first!.prev).toBeNull();
    expect(first!.next?.slug).toBe("ikinci");
    expect(last!.next).toBeNull();
    expect(last!.prev?.slug).toBe("ikinci");
  });

  it("returns null for unknown lessons", async () => {
    expect(await getLesson("test-course", "yoxdur", ROOT)).toBeNull();
    expect(await getLesson("test-course", "../birinci", ROOT)).toBeNull();
  });
});
