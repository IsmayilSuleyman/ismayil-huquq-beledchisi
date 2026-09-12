"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-guard";
import { getLesson, isSlug } from "@/lib/content";
import { getQuiz, gradeQuiz, type GradedQuiz } from "@/lib/quiz";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ToggleResult = { ok: true } | { ok: false; message: string };

/**
 * Marks a lesson completed (or clears the mark) for the signed-in person.
 * The lesson must exist on disk so stray slugs never reach the table.
 */
export async function setLessonCompleted(
  courseSlug: string,
  lessonSlug: string,
  completed: boolean,
): Promise<ToggleResult> {
  const user = await requireUser();

  if (!isSlug(courseSlug) || !isSlug(lessonSlug)) {
    return { ok: false, message: "Dərs tapılmadı." };
  }
  const page = await getLesson(courseSlug, lessonSlug);
  if (!page) {
    return { ok: false, message: "Dərs tapılmadı." };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, message: "Verilənlər bazası hazır deyil." };
  }

  const { error } = completed
    ? await supabase.from("lesson_progress").upsert(
        { user_id: user.id, course_slug: courseSlug, lesson_slug: lessonSlug },
        { onConflict: "user_id,course_slug,lesson_slug", ignoreDuplicates: true },
      )
    : await supabase
        .from("lesson_progress")
        .delete()
        .match({ user_id: user.id, course_slug: courseSlug, lesson_slug: lessonSlug });

  if (error) {
    console.error("lesson_progress write failed:", error);
    return { ok: false, message: "İrəliləyiş yadda saxlanılmadı. Yenidən cəhd edin." };
  }

  revalidatePath("/courses");
  revalidatePath(`/courses/${courseSlug}`);
  revalidatePath(`/courses/${courseSlug}/${lessonSlug}`);
  revalidatePath("/account");
  return { ok: true };
}

export type QuizSubmitResult =
  | ({ ok: true; lessonCompleted: boolean } & GradedQuiz)
  | { ok: false; message: string };

/**
 * Grades a test on the server (the answer key never reaches the browser),
 * records the attempt, and marks the lesson completed on a pass.
 */
export async function submitQuiz(
  courseSlug: string,
  lessonSlug: string,
  answers: Record<string, number>,
): Promise<QuizSubmitResult> {
  const user = await requireUser();

  if (!isSlug(courseSlug) || !isSlug(lessonSlug)) {
    return { ok: false, message: "Test tapılmadı." };
  }
  const quiz = await getQuiz(courseSlug, lessonSlug);
  if (!quiz) {
    return { ok: false, message: "Test tapılmadı." };
  }

  const clean: Record<string, number> = {};
  if (answers && typeof answers === "object") {
    for (const q of quiz.questions) {
      const v = answers[q.id];
      if (Number.isInteger(v)) clean[q.id] = v;
    }
  }
  const graded = gradeQuiz(quiz, clean);

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, message: "Verilənlər bazası hazır deyil." };
  }

  const { error } = await supabase.from("quiz_attempts").insert({
    user_id: user.id,
    course_slug: courseSlug,
    lesson_slug: lessonSlug,
    score: graded.score,
    total: graded.total,
    passed: graded.passed,
    answers: clean,
  });
  if (error) {
    console.error("quiz_attempts write failed:", error);
    return { ok: false, message: "Nəticə yadda saxlanılmadı. Yenidən cəhd edin." };
  }

  let lessonCompleted = false;
  if (graded.passed) {
    const { error: progressError } = await supabase.from("lesson_progress").upsert(
      { user_id: user.id, course_slug: courseSlug, lesson_slug: lessonSlug },
      { onConflict: "user_id,course_slug,lesson_slug", ignoreDuplicates: true },
    );
    if (progressError) console.error("lesson_progress write failed:", progressError);
    else lessonCompleted = true;
  }

  revalidatePath("/courses");
  revalidatePath(`/courses/${courseSlug}`);
  revalidatePath(`/courses/${courseSlug}/${lessonSlug}`);
  revalidatePath("/account");
  return { ok: true, lessonCompleted, ...graded };
}
