import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth-guard";
import { getLesson, isSlug } from "@/lib/content";
import { renderLessonPdf } from "@/lib/pdf/lesson-pdf";
import { getLessonHighlights } from "@/lib/progress";
import { profileFromUser } from "@/lib/user";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = Promise<{ course: string; lesson: string }>;

/**
 * GET /courses/<course>/<lesson>/pdf — the lesson as a downloadable PDF with
 * the reader's own highlights and notes appended. Signed-in only, like the
 * lesson page; the middleware bounces anonymous requests before this runs.
 */
export async function GET(request: Request, { params }: { params: Params }) {
  const { course: courseSlug, lesson: lessonSlug } = await params;
  if (!isSlug(courseSlug) || !isSlug(lessonSlug)) notFound();

  const user = await requireUser(`/courses/${courseSlug}/${lessonSlug}`);
  const [page, highlights] = await Promise.all([
    getLesson(courseSlug, lessonSlug),
    getLessonHighlights(user.id, courseSlug, lessonSlug),
  ]);
  if (!page) notFound();

  const profile = profileFromUser(user);
  const pdf = await renderLessonPdf({
    page,
    highlights,
    host: new URL(request.url).host,
    readerName: profile.fullName,
  });

  const index = page.course.lessons.findIndex((l) => l.slug === lessonSlug) + 1;
  const asciiName = `${courseSlug}-${String(index).padStart(2, "0")}-${lessonSlug}.pdf`;
  const niceName = `Dərs ${index}. ${page.lesson.title}.pdf`;

  // Copy into a plain ArrayBuffer-backed view: Response wants that exact type.
  const body = new Uint8Array(pdf.byteLength);
  body.set(pdf);

  return new Response(body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(body.byteLength),
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(niceName)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
