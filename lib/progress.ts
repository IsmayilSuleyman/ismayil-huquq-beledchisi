import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Course } from "@/lib/content";

/** Key used in the completed-lessons set: "course-slug/lesson-slug". */
export function progressKey(courseSlug: string, lessonSlug: string): string {
  return `${courseSlug}/${lessonSlug}`;
}

/**
 * All lessons the signed-in person has completed, across every course.
 * RLS on lesson_progress guarantees the query only ever sees their rows.
 * A database hiccup degrades to "nothing completed" rather than an error
 * page — progress is a convenience, the lesson text is the product.
 */
export async function getCompletedLessons(userId: string): Promise<Set<string>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return new Set();

  const { data, error } = await supabase
    .from("lesson_progress")
    .select("course_slug, lesson_slug")
    .eq("user_id", userId);

  if (error) {
    console.error("lesson_progress read failed:", error);
    return new Set();
  }

  return new Set(
    (data ?? []).map((row) => progressKey(row.course_slug, row.lesson_slug)),
  );
}

export type CourseProgress = {
  completed: number;
  total: number;
  percent: number;
  /** First lesson not yet completed, or null when the course is finished. */
  nextLessonSlug: string | null;
};

export function courseProgress(
  course: Course,
  completed: Set<string>,
): CourseProgress {
  const total = course.lessons.length;
  let done = 0;
  let nextLessonSlug: string | null = null;
  for (const lesson of course.lessons) {
    if (completed.has(progressKey(course.slug, lesson.slug))) {
      done += 1;
    } else if (nextLessonSlug === null) {
      nextLessonSlug = lesson.slug;
    }
  }
  return {
    completed: done,
    total,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
    nextLessonSlug,
  };
}

export type QuizBest = {
  score: number;
  total: number;
  percent: number;
  passed: boolean;
  attempts: number;
};

/**
 * Best test result per lesson for the signed-in person, keyed like
 * progressKey. Reads every attempt (a handful of rows per lesson) and folds
 * them here; the same "degrade to empty" rule as completed lessons applies.
 */
export async function getQuizBests(userId: string): Promise<Map<string, QuizBest>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return new Map();

  const { data, error } = await supabase
    .from("quiz_attempts")
    .select("course_slug, lesson_slug, score, total, passed")
    .eq("user_id", userId);

  if (error) {
    console.error("quiz_attempts read failed:", error);
    return new Map();
  }

  const bests = new Map<string, QuizBest>();
  for (const row of data ?? []) {
    const key = progressKey(row.course_slug, row.lesson_slug);
    const percent = row.total > 0 ? Math.round((row.score / row.total) * 100) : 0;
    const prev = bests.get(key);
    if (!prev) {
      bests.set(key, { score: row.score, total: row.total, percent, passed: row.passed, attempts: 1 });
    } else {
      bests.set(key, {
        score: percent > prev.percent ? row.score : prev.score,
        total: percent > prev.percent ? row.total : prev.total,
        percent: Math.max(prev.percent, percent),
        passed: prev.passed || row.passed,
        attempts: prev.attempts + 1,
      });
    }
  }
  return bests;
}

export function countPassed(bests: Map<string, QuizBest>): number {
  let n = 0;
  for (const b of bests.values()) if (b.passed) n += 1;
  return n;
}
