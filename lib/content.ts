import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";

/**
 * File-based course content. Each course is a folder under content/courses:
 *
 *   content/courses/<course-slug>/course.json
 *   content/courses/<course-slug>/lessons/01-<lesson-slug>.mdx
 *
 * The numeric prefix on a lesson file is only for ordering in the editor;
 * the URL slug is the part after it. Frontmatter `order` wins over the
 * prefix when both are present.
 */

export const CONTENT_ROOT = path.join(process.cwd(), "content", "courses");

export type CourseMeta = {
  slug: string;
  title: string;
  description: string;
  order: number;
  level: string | null;
};

export type LessonMeta = {
  slug: string;
  courseSlug: string;
  title: string;
  summary: string;
  order: number;
  minutes: number | null;
  /** True when content/courses/<course>/quizzes/<lesson>.json exists. */
  hasQuiz: boolean;
};

export type Lesson = LessonMeta & { body: string };

export type Course = CourseMeta & { lessons: LessonMeta[] };

export type LessonPage = {
  course: Course;
  lesson: Lesson;
  prev: LessonMeta | null;
  next: LessonMeta | null;
};

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LESSON_FILE = /^(?:(\d+)-)?([a-z0-9]+(?:-[a-z0-9]+)*)\.mdx$/;

export function isSlug(value: string): boolean {
  return SLUG.test(value);
}

export function lessonSlugFromFile(
  file: string,
): { slug: string; order: number | null } | null {
  const m = LESSON_FILE.exec(file);
  if (!m) return null;
  return { slug: m[2], order: m[1] ? Number(m[1]) : null };
}

export function sortLessons(lessons: LessonMeta[]): LessonMeta[] {
  return [...lessons].sort(
    (a, b) => a.order - b.order || a.slug.localeCompare(b.slug),
  );
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toLessonMeta(
  courseSlug: string,
  parsed: { slug: string; order: number | null },
  data: Record<string, unknown>,
  hasQuiz: boolean,
): LessonMeta {
  return {
    slug: parsed.slug,
    courseSlug,
    title: asString(data.title, parsed.slug),
    summary: asString(data.summary, ""),
    order: asNumber(data.order) ?? parsed.order ?? 0,
    minutes: asNumber(data.minutes),
    hasQuiz,
  };
}

/** Lesson slugs that have a test file next to the lessons folder. */
async function readQuizSlugs(quizzesDir: string): Promise<Set<string>> {
  try {
    const files = await fs.readdir(quizzesDir);
    return new Set(
      files
        .filter((f) => f.endsWith(".json"))
        .map((f) => f.slice(0, -".json".length))
        .filter(isSlug),
    );
  } catch {
    return new Set();
  }
}

async function readLessonMetas(
  courseSlug: string,
  courseDir: string,
): Promise<LessonMeta[]> {
  const lessonsDir = path.join(courseDir, "lessons");
  let files: string[];
  try {
    files = await fs.readdir(lessonsDir);
  } catch {
    return [];
  }
  const quizzes = await readQuizSlugs(path.join(courseDir, "quizzes"));

  const metas: LessonMeta[] = [];
  for (const file of files) {
    const parsed = lessonSlugFromFile(file);
    if (!parsed) continue;
    const raw = await fs.readFile(path.join(lessonsDir, file), "utf8");
    const { data } = matter(raw);
    metas.push(toLessonMeta(courseSlug, parsed, data, quizzes.has(parsed.slug)));
  }
  return sortLessons(metas);
}

export async function getCourse(
  slug: string,
  root: string = CONTENT_ROOT,
): Promise<Course | null> {
  if (!isSlug(slug)) return null;

  const dir = path.join(root, slug);
  let raw: string;
  try {
    raw = await fs.readFile(path.join(dir, "course.json"), "utf8");
  } catch {
    return null;
  }

  const meta = JSON.parse(raw) as Record<string, unknown>;
  const lessons = await readLessonMetas(slug, dir);

  return {
    slug,
    title: asString(meta.title, slug),
    description: asString(meta.description, ""),
    order: asNumber(meta.order) ?? 0,
    level: typeof meta.level === "string" && meta.level ? meta.level : null,
    lessons,
  };
}

export async function listCourses(root: string = CONTENT_ROOT): Promise<Course[]> {
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }

  const courses: Course[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const course = await getCourse(entry.name, root);
    if (course) courses.push(course);
  }

  return courses.sort(
    (a, b) => a.order - b.order || a.title.localeCompare(b.title, "az"),
  );
}

export async function getLesson(
  courseSlug: string,
  lessonSlug: string,
  root: string = CONTENT_ROOT,
): Promise<LessonPage | null> {
  if (!isSlug(lessonSlug)) return null;

  const course = await getCourse(courseSlug, root);
  if (!course) return null;

  const index = course.lessons.findIndex((l) => l.slug === lessonSlug);
  if (index < 0) return null;

  const lessonsDir = path.join(root, courseSlug, "lessons");
  const files = await fs.readdir(lessonsDir);
  const file = files.find((f) => lessonSlugFromFile(f)?.slug === lessonSlug);
  if (!file) return null;

  const raw = await fs.readFile(path.join(lessonsDir, file), "utf8");
  const { content } = matter(raw);

  return {
    course,
    lesson: { ...course.lessons[index], body: content },
    prev: course.lessons[index - 1] ?? null,
    next: course.lessons[index + 1] ?? null,
  };
}

export function countLessons(courses: Course[]): number {
  return courses.reduce((sum, c) => sum + c.lessons.length, 0);
}

export function countQuizzes(courses: Course[]): number {
  return courses.reduce((sum, c) => sum + c.lessons.filter((l) => l.hasQuiz).length, 0);
}
