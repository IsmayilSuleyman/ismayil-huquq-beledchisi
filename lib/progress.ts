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
