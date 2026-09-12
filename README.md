# İsmayıl Hüquq Bələdçisi

A learning platform for law, in Azerbaijani. People sign in with their Google
account, read courses built from lessons, and their progress is saved on the
account. Same glass-and-gradient design language as the İRF portal, in a
cream and dark-wood palette.

**Omni Law Gazette** — the weekly legislation digest — is a separate app
(`IsmayilSuleyman/omnilawgazette`, its own design and deployment) mounted
under `/gazette` of this site: that app runs with `basePath: "/gazette"` and
`next.config.ts` here proxies every `/gazette` request to it (Next.js
multi-zones). Both share one Supabase project. The guide's header pill, phone
tab and landing page link to `/gazette`; the gazette's header pill links back
to `/`. The landing page shows the gazette's latest issue from the shared table.

- **Stack:** Next.js 15 (App Router) + TypeScript + Tailwind + Supabase Auth
  (Google) + MDX content in the repo
- **Hosting:** Vercel
- **Language:** Azerbaijani UI and content

---

## 1. Supabase setup

The site shares one Supabase project with the gazette (the
`omni-law-gazette` project). It holds:

- `lesson_progress` — the guide's per-user lesson completion (migration in
  `supabase/migrations/20260912120000_lesson_progress.sql`, already applied);
- `issues`, `comments`, `admin_emails` and the public `gazette` storage bucket
  — the gazette's data, managed from the gazette site. The guide only reads
  `issues` for the landing page.

Steps for a fresh project would be: create it, run the migration in
**SQL Editor**, then configure Google sign-in below.
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

`GAZETTE_ORIGIN` (in `.env.production`) is the gazette deployment the
`/gazette` proxy targets; `NEXT_PUBLIC_GAZETTE_URL` is the mounted path used
by links. Locally, `/gazette` proxies to the live gazette.

`.npmrc` sets `legacy-peer-deps=true`: the Tailwind 3 / Vitest 4 dependency
graph trips npm's strict peer resolver otherwise. Vercel reads the same file.

Checks: `npm test` (loader tests), `npm run lint`, `npm run build`.

---

## 3. Deploy to Vercel

Import the repo on <https://vercel.com/new> as its own project and give it
the public hostname (`ismayilhuquqbeledchisi.vercel.app`). The gazette keeps
the `omnilawgazette` project; its production hostname must serve directly
(no redirect rule), because this site proxies `/gazette` to it.
`.env.production` carries the public Supabase values and the gazette origin,
so no dashboard variables are needed; dashboard variables override the file
if you add them. Then add the production hostname to the Supabase
**Redirect URLs** (`https://<host>/auth/callback`) and to the Google client's
**Authorized JavaScript origins**.

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
  gazette.ts                      Gazette issue reads (landing page) + site URL
  gazette-format.ts               Azerbaijani date helpers
  content.ts                      File-based course/lesson loader
  progress.ts                     Completed-lessons reads and per-course maths
  auth-guard.ts                   requireUser()
  user.ts                         Profile fields from the Google identity
  supabase/                       Server, browser clients and env config
components/
  AppHeader (with the switch pill to the gazette), MobileTabBar, ThemeToggle,
  PageBackground, Wordmark, LessonBody (MDX render), CompleteToggle,
  ProgressBar, Skeleton, StatTile, gazette/OmniLogo
content/courses/                  Courses and lessons (MDX)
supabase/migrations/              lesson_progress table + policies
tests/                            Vitest: content loader
middleware.ts                     Auth gate for /courses and /account
```

## Roadmap

1. ✅ Design system, Google sign-in, file-based courses, lesson progress
   ✅ Linked with Omni Law Gazette (separate site, shared database)
2. Private beta with a few readers; more courses
3. Tests and quizzes per lesson (MDX components + attempts table)
4. AI tutor grounded in the open lesson
5. Payments (merchant of record) and public launch
