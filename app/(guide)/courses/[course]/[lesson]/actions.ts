"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-guard";
import { getLesson, isSlug } from "@/lib/content";
import { getQuiz, gradeQuiz, type GradedQuiz } from "@/lib/quiz";
import {
  isHighlightColor,
  isHighlightId,
  isTextAnchor,
  MAX_NOTE,
  type HighlightColor,
  type TextAnchor,
} from "@/lib/highlights";
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

// ---------------------------------------------------------------------------
// Highlights and notes
// ---------------------------------------------------------------------------

export type AddHighlightResult =
  | { ok: true; id: string; createdAt: string }
  | { ok: false; message: string };

const HIGHLIGHT_SAVE_FAILED = "İşarələmə yadda saxlanılmadı. Yenidən cəhd edin.";

/**
 * Stores a highlight the reader made in a lesson. The anchor (exact passage,
 * context and offsets) comes from the browser and is only checked for shape
 * and size here; the lesson must exist so stray slugs never reach the table.
 * The lesson page is not revalidated: the browser already shows the mark,
 * and a refresh would re-render the text under the reader's feet.
 */
export async function addHighlight(
  courseSlug: string,
  lessonSlug: string,
  anchor: TextAnchor,
  color: HighlightColor,
): Promise<AddHighlightResult> {
  const user = await requireUser();

  if (!isSlug(courseSlug) || !isSlug(lessonSlug)) {
    return { ok: false, message: "Dərs tapılmadı." };
  }
  if (!isTextAnchor(anchor) || !isHighlightColor(color)) {
    return { ok: false, message: "Seçim düzgün deyil." };
  }
  const page = await getLesson(courseSlug, lessonSlug);
  if (!page) {
    return { ok: false, message: "Dərs tapılmadı." };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, message: "Verilənlər bazası hazır deyil." };
  }

  const { data, error } = await supabase
    .from("lesson_highlights")
    .insert({
      user_id: user.id,
      course_slug: courseSlug,
      lesson_slug: lessonSlug,
      exact: anchor.exact,
      prefix: anchor.prefix,
      suffix: anchor.suffix,
      start_offset: anchor.start,
      end_offset: anchor.end,
      color,
    })
    .select("id, created_at")
    .single();

  if (error || !data) {
    console.error("lesson_highlights insert failed:", error);
    return { ok: false, message: HIGHLIGHT_SAVE_FAILED };
  }
  return { ok: true, id: data.id, createdAt: data.created_at };
}

export type HighlightPatch = { color?: HighlightColor; note?: string };

/** Changes the colour and/or the note of one of the reader's highlights. */
export async function updateHighlight(
  id: string,
  patch: HighlightPatch,
): Promise<ToggleResult> {
  const user = await requireUser();

  if (!isHighlightId(id) || !patch || typeof patch !== "object") {
    return { ok: false, message: "İşarələmə tapılmadı." };
  }
  const values: Record<string, string> = {};
  if (patch.color !== undefined) {
    if (!isHighlightColor(patch.color)) return { ok: false, message: "Rəng düzgün deyil." };
    values.color = patch.color;
  }
  if (patch.note !== undefined) {
    if (typeof patch.note !== "string" || patch.note.length > MAX_NOTE) {
      return { ok: false, message: `Qeyd ən çox ${MAX_NOTE} simvol ola bilər.` };
    }
    values.note = patch.note.trim();
  }
  if (Object.keys(values).length === 0) return { ok: true };
  values.updated_at = new Date().toISOString();

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, message: "Verilənlər bazası hazır deyil." };
  }

  const { error, count } = await supabase
    .from("lesson_highlights")
    .update(values, { count: "exact" })
    .match({ id, user_id: user.id });

  if (error) {
    console.error("lesson_highlights update failed:", error);
    return { ok: false, message: HIGHLIGHT_SAVE_FAILED };
  }
  if (count === 0) {
    return { ok: false, message: "İşarələmə tapılmadı." };
  }
  return { ok: true };
}

/** Removes one of the reader's highlights together with its note. */
export async function deleteHighlight(id: string): Promise<ToggleResult> {
  const user = await requireUser();

  if (!isHighlightId(id)) {
    return { ok: false, message: "İşarələmə tapılmadı." };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, message: "Verilənlər bazası hazır deyil." };
  }

  const { error } = await supabase
    .from("lesson_highlights")
    .delete()
    .match({ id, user_id: user.id });

  if (error) {
    console.error("lesson_highlights delete failed:", error);
    return { ok: false, message: "İşarələmə silinmədi. Yenidən cəhd edin." };
  }
  return { ok: true };
}
