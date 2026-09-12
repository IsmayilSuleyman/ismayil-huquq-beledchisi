import { compile } from "@mdx-js/mdx";
import remarkGfm from "remark-gfm";
import { describe, expect, it } from "vitest";
import { getLesson, listCourses } from "@/lib/content";

/**
 * Every lesson under content/ must compile with the same MDX pipeline the
 * lesson page uses, so a stray `<` or `{` in a new lesson fails here rather
 * than on a live page. Also checks the fields the UI relies on are filled.
 */
describe("content/courses", () => {
  it("has at least one course with lessons", async () => {
    const courses = await listCourses();
    expect(courses.length).toBeGreaterThan(0);
    for (const course of courses) {
      expect(course.title.length).toBeGreaterThan(0);
      expect(course.description.length).toBeGreaterThan(0);
      expect(course.lessons.length).toBeGreaterThan(0);
    }
  });

  it("every lesson compiles as MDX and carries a title and summary", async () => {
    const courses = await listCourses();
    for (const course of courses) {
      for (const meta of course.lessons) {
        const page = await getLesson(course.slug, meta.slug);
        expect(page, `${course.slug}/${meta.slug}`).not.toBeNull();
        expect(page!.lesson.title.length).toBeGreaterThan(0);
        expect(page!.lesson.summary.length).toBeGreaterThan(0);
        await expect(
          compile(page!.lesson.body, { remarkPlugins: [remarkGfm] }),
          `${course.slug}/${meta.slug} should compile`,
        ).resolves.toBeDefined();
      }
    }
  });

  it("lesson orders are unique within a course", async () => {
    for (const course of await listCourses()) {
      const orders = course.lessons.map((l) => l.order);
      expect(new Set(orders).size, course.slug).toBe(orders.length);
    }
  });
});
