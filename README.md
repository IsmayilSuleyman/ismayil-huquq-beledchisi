# İsmayıl Hüquq Bələdçisi

A learning platform for law, in Azerbaijani. People sign in with their Google
account, read courses built from lessons, and their progress is saved on the
account. Same glass-and-gradient design language as the İRF portal, in a
cream and dark-wood palette.

- **Stack:** Next.js 15 (App Router) + TypeScript + Tailwind + Supabase Auth
  (Google) + MDX content in the repo
- **Hosting:** Vercel
- **Language:** Azerbaijani UI and content

---

## 1. Supabase setup

1. Create a project at <https://supabase.com/>.
2. Run `supabase/migrations/20260912120000_lesson_progress.sql` in
   **SQL Editor**. It creates the `lesson_progress` table with row-level
   security so each person can only read and write their own rows.
3. **Authentication → Providers → Google**: enable it. You need a Google
   OAuth client (next section) for the Client ID and Client Secret.
4. **Authentication → URL Configuration**:
   - **Site URL**: your production URL (e.g. `https://huquq.example.az`).
   - **Redirect URLs**: add `https://<your-domain>/auth/callback` and
     `http://localhost:3000/auth/callback`.
5. Copy **Project URL** and the **publishable key** from
   **Project Settings → API**.

### Google OAuth client

1. <https://console.cloud.google.com/> → create a project (or reuse one).
2. **APIs & Services → OAuth consent screen**: External, fill in the app name
   and support email. Add your own account as a test user until you publish
   the consent screen.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**,
   type **Web application**:
   - **Authorized JavaScript origins**: your production URL and
     `http://localhost:3000`.
   - **Authorized redirect URIs**: `https://<project-ref>.supabase.co/auth/v1/callback`
     (Supabase shows the exact value on the Google provider page).
4. Paste the Client ID and Client Secret into the Supabase Google provider.

Sign-up is open by design: anyone with a Google account can sign in. Payments
and plan gating come later.

---

## 2. Local development

```bash
npm install
cp .env.local.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev
```

Open <http://localhost:3000>. The landing page is public; `/courses` and
`/account` require sign-in. Without the two env vars the site still builds and
runs, but shows a "setup pending" notice instead of the Google button.

`.npmrc` sets `legacy-peer-deps=true`: the Tailwind 3 / Vitest 4 dependency
graph trips npm's strict peer resolver otherwise. Vercel reads the same file.

Checks: `npm test` (loader tests), `npm run lint`, `npm run build`.

---

## 3. Deploy to Vercel

1. Import the repo on <https://vercel.com/new>.
2. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` under
   **Project → Settings → Environment Variables**.
3. Deploy, then add the Vercel URL (or your domain) to the Supabase
   **Redirect URLs** and the Google client's **Authorized JavaScript origins**.

---

## 4. Adding a course

Content lives in the repo, so writing a lesson is a commit:

```
content/courses/<course-slug>/course.json
content/courses/<course-slug>/lessons/01-<lesson-slug>.mdx
content/courses/<course-slug>/lessons/02-<lesson-slug>.mdx
```

`course.json`:

```json
{
  "title": "Hüququn əsasları",
  "description": "One or two sentences shown on the course card.",
  "order": 1,
  "level": "Giriş"
}
```

Lesson frontmatter:

```md
---
title: Hüquq anlayışı və hüququn əlamətləri
summary: One sentence shown in the lesson list.
minutes: 12
order: 1
---

## Heading

Body in Markdown. Tables, lists and blockquotes work (GitHub-flavoured
Markdown). Avoid raw `<` and `{` characters in prose: the files are MDX.
```

Rules:

- Slugs are lowercase letters, digits and hyphens only. The numeric prefix on a
  lesson file (`01-`) only orders files in the editor; the URL uses the part
  after it. `order` in frontmatter wins when both are present.
- Progress rows reference slugs, so renaming a slug orphans the completion
  marks for that lesson.
- The starter course under `content/courses/huququn-esaslari` was written as
  an illustration of the intended register. Verify every article reference
  against the current text of the law before publishing it to paying users.

---

## File map

```
app/
  layout.tsx                      Root layout, fonts (Inter + Source Serif), theme script
  page.tsx                        Public landing page
  login/page.tsx                  Google sign-in card
  auth/callback/route.ts          OAuth code → session exchange
  courses/page.tsx                Course list with progress
  courses/[course]/page.tsx       Course page: lessons, stats, "continue"
  courses/[course]/[lesson]/      Lesson page (MDX) + completion action
  account/page.tsx                Profile and per-course progress
lib/
  content.ts                      File-based course/lesson loader
  progress.ts                     Completed-lessons reads and per-course maths
  auth-guard.ts                   requireUser()
  user.ts                         Profile fields from the Google identity
  supabase/                       Server, browser clients and env config
components/
  AppHeader, MobileTabBar, ThemeToggle, PageBackground, Wordmark,
  LessonBody (MDX render), CompleteToggle, ProgressBar, Skeleton, StatTile
content/courses/                  Courses and lessons (MDX)
supabase/migrations/              lesson_progress table + policies
tests/                            Vitest: content loader
middleware.ts                     Auth gate for /courses and /account
```

## Roadmap

1. ✅ Design system, Google sign-in, file-based courses, lesson progress
2. Private beta with a few readers; more courses
3. Tests and quizzes per lesson (MDX components + attempts table)
4. AI tutor grounded in the open lesson
5. Payments (merchant of record) and public launch
