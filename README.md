# İsmayıl Hüquq Bələdçisi

A learning platform for law, in Azerbaijani. People sign in with their Google
account, read courses built from lessons, and their progress is saved on the
account. Same glass-and-gradient design language as the İRF portal, in a
cream and dark-wood palette.

**Omni Law Gazette** — the weekly legislation digest — lives in this repo as
its own section under `/gazette`. It keeps its original dark design: the
route group `app/(gazette)` has its own layout and stylesheet
(`gazette.css`, every class prefixed `olg-`), so the two designs never mix.
Both sections share one Supabase project. The guide's header pill, phone tab
and landing page link to `/gazette`; the gazette's header pill links back to
`/`. The landing page shows the gazette's latest issue from the shared table.
The gazette pages are public; `/gazette/admin` signs in with the gazette's
own email/password flow (admins listed in `admin_emails`).

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
  — the gazette's data, managed from `/gazette/admin`.

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

`npm install` also copies the pdf.js worker into `public/` (`postinstall`);
the gazette's issue viewer needs it. `scripts/scrape-gazette.mjs` and
`scripts/EQANUN-EXTRACTION.md` are the gazette's issue-drafting tools;
drafts land in `scripts/gazettes/`.

`.npmrc` sets `legacy-peer-deps=true`: the Tailwind 3 / Vitest 4 dependency
graph trips npm's strict peer resolver otherwise. Vercel reads the same file.

Checks: `npm test` (loader and date tests), `npm run lint`, `npm run build`.

---

## 3. Deploy to Vercel

One Vercel project serves both sections: the existing **omnilawgazette**
project, with `ismayilhuquqbeledchisi.vercel.app` as its main hostname. Its
Git connection still points at `IsmayilSuleyman/omnilawgazette`, so a deploy
is a push of this repo's `main` to that repo's `main` (the two histories are
kept in step with a merge commit, never a force push). Repointing the Vercel
project's Git connection to this repo removes that step.

`.env.production` carries the public Supabase values, so no dashboard
variables are needed; dashboard variables override the file if you add them.
On `omnilawgazette.vercel.app`, point the redirect rule at
`https://ismayilhuquqbeledchisi.vercel.app/gazette` so old gazette links keep
working. Then add the production hostname to the Supabase **Redirect URLs**
(`https://<host>/auth/callback`) and to the Google client's **Authorized
JavaScript origins**.

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
  layout.tsx                      Root layout: fonts (Inter, Nunito, Fraunces, Jost), theme script
  auth/callback/route.ts          OAuth code → session exchange
  (guide)/layout.tsx              Guide chrome: background, phone tab bar, theme toggle
  (guide)/page.tsx                Public landing page
  (guide)/login/page.tsx          Google sign-in card
  (guide)/courses/page.tsx        Course list with progress
  (guide)/courses/[course]/       Course page; [lesson]/ lesson page (MDX) + completion action
  (guide)/account/page.tsx        Profile and per-course progress
  (gazette)/layout.tsx            Gazette chrome (original design), imports gazette.css
  (gazette)/gazette/              Library, issues/[number] viewer, admin
lib/
  gazette.ts                      Gazette issue reads for the landing page + /gazette URL
  gazette-format.ts               Azerbaijani date helpers
  gazette/                        Gazette's own Supabase clients, types, formatting, PDF analysis
  content.ts                      File-based course/lesson loader
  progress.ts                     Completed-lessons reads and per-course maths
  auth-guard.ts                   requireUser()
  user.ts                         Profile fields from the Google identity
  supabase/                       Server, browser clients and env config
components/
  AppHeader (with the switch pill to the gazette), MobileTabBar, ThemeToggle,
  PageBackground, Wordmark, LessonBody (MDX render), CompleteToggle,
  ProgressBar, Skeleton, StatTile, gazette/OmniLogo
components/gazette/               Gazette UI: SiteHeader (pill back to /), IssueCard,
                                  LibraryExplorer, PdfViewer, Comments, admin/*
content/courses/                  Courses and lessons (MDX)
scripts/                          pdf.js worker copy, gazette scraper and drafts
supabase/migrations/              lesson_progress table + policies
tests/                            Vitest: content loader
middleware.ts                     Auth gate for /courses and /account
```

## Roadmap

1. ✅ Design system, Google sign-in, file-based courses, lesson progress
   ✅ Omni Law Gazette folded in at `/gazette`, original design, shared database
2. Private beta with a few readers; more courses
3. Tests and quizzes per lesson (MDX components + attempts table)
4. AI tutor grounded in the open lesson
5. Payments (merchant of record) and public launch
