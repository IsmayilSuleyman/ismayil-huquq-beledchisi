"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-guard";
import { getLesson, isSlug } from "@/lib/content";
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
