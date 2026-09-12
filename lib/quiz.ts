import { promises as fs } from "node:fs";
import path from "node:path";
import { CONTENT_ROOT, isSlug } from "@/lib/content";

/**
 * Per-lesson tests. A lesson has a test when a JSON file with the lesson's
 * slug exists under the course's quizzes folder:
 *
 *   content/courses/<course-slug>/quizzes/<lesson-slug>.json
 *
 * {
 *   "pass": 70,                       // percent needed to pass (default 70)
 *   "questions": [
 *     {
 *       "id": "q1",
 *       "prompt": "Sual mətni",
 *       "options": ["A", "B", "C", "D"],
 *       "answer": 2,                   // index into options
 *       "explanation": "Nə üçün belədir."
 *     }
 *   ]
 * }
 *
 * The correct answers never leave the server: pages receive PublicQuestion,
 * the server action grades the submission and returns the explanations.
 */

export type Question = {
  id: string;
  prompt: string;
  options: string[];
  answer: number;
  explanation: string;
};

export type Quiz = {
  courseSlug: string;
  lessonSlug: string;
  pass: number;
  questions: Question[];
};

export type PublicQuestion = Omit<Question, "answer" | "explanation">;

export type QuestionResult = {
  id: string;
  given: number | null;
  correct: number;
  isCorrect: boolean;
  explanation: string;
};

export type GradedQuiz = {
  score: number;
  total: number;
  percent: number;
  passed: boolean;
  results: QuestionResult[];
};

export const DEFAULT_PASS = 70;

export function quizPath(courseSlug: string, lessonSlug: string, root = CONTENT_ROOT): string {
  return path.join(root, courseSlug, "quizzes", `${lessonSlug}.json`);
}

/** Validates the raw JSON shape; throws with a readable message on a bad file. */
export function parseQuiz(raw: unknown, courseSlug: string, lessonSlug: string): Quiz {
  if (!raw || typeof raw !== "object") throw new Error("quiz must be an object");
  const data = raw as Record<string, unknown>;
  const pass =
    typeof data.pass === "number" && data.pass >= 0 && data.pass <= 100 ? data.pass : DEFAULT_PASS;
  if (!Array.isArray(data.questions) || data.questions.length === 0) {
    throw new Error("quiz needs at least one question");
  }
  const ids = new Set<string>();
  const questions = data.questions.map((q, i) => {
    const item = (q ?? {}) as Record<string, unknown>;
    const id = typeof item.id === "string" && item.id.trim() ? item.id.trim() : "";
    if (!id) throw new Error(`question ${i + 1}: missing id`);
    if (ids.has(id)) throw new Error(`question ${i + 1}: duplicate id "${id}"`);
    ids.add(id);
    const prompt = typeof item.prompt === "string" ? item.prompt.trim() : "";
    if (!prompt) throw new Error(`question "${id}": missing prompt`);
    const options = Array.isArray(item.options)
      ? item.options.map((o) => (typeof o === "string" ? o.trim() : ""))
      : [];
    if (options.length < 2 || options.some((o) => !o)) {
      throw new Error(`question "${id}": needs at least two non-empty options`);
    }
    const answer = item.answer;
    if (!Number.isInteger(answer) || (answer as number) < 0 || (answer as number) >= options.length) {
      throw new Error(`question "${id}": answer must index an option`);
    }
    const explanation = typeof item.explanation === "string" ? item.explanation.trim() : "";
    return { id, prompt, options, answer: answer as number, explanation };
  });
  return { courseSlug, lessonSlug, pass, questions };
}

export async function getQuiz(
  courseSlug: string,
  lessonSlug: string,
  root: string = CONTENT_ROOT,
): Promise<Quiz | null> {
  if (!isSlug(courseSlug) || !isSlug(lessonSlug)) return null;
  let raw: string;
  try {
    raw = await fs.readFile(quizPath(courseSlug, lessonSlug, root), "utf8");
  } catch {
    return null;
  }
  return parseQuiz(JSON.parse(raw), courseSlug, lessonSlug);
}

export function toPublicQuestions(quiz: Quiz): PublicQuestion[] {
  return quiz.questions.map(({ id, prompt, options }) => ({ id, prompt, options }));
}

/** Grades a submission. `answers` maps question id to the chosen option index. */
export function gradeQuiz(quiz: Quiz, answers: Record<string, number>): GradedQuiz {
  const results = quiz.questions.map((q) => {
    const raw = answers[q.id];
    const given = Number.isInteger(raw) && raw >= 0 && raw < q.options.length ? raw : null;
    return {
      id: q.id,
      given,
      correct: q.answer,
      isCorrect: given === q.answer,
      explanation: q.explanation,
    };
  });
  const total = quiz.questions.length;
  const score = results.filter((r) => r.isCorrect).length;
  const percent = total === 0 ? 0 : Math.round((score / total) * 100);
  return { score, total, percent, passed: percent >= quiz.pass, results };
}
