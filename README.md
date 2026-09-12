# İsmayıl Hüquq Bələdçisi

A learning platform for law, in Azerbaijani. People sign in with their Google
account, read courses built from lessons, and their progress is saved on the
account. Same glass-and-gradient design language as the İRF portal, in a
cream and dark-wood palette.

**Omni Law Gazette** — the weekly legislation digest — lives here too, as the
`/gazette` section: a library of PDF issues, a reading room, open discussion
under each issue, and an editor desk. The header carries a switch pill between
the guide and the gazette, like the İRF ↔ İsmayılBank switch on the portal.

- **Stack:** Next.js 15 (App Router) + TypeScript + Tailwind + Supabase Auth
  (Google) + MDX content in the repo + react-pdf for the gazette reader
- **Hosting:** Vercel
- **Language:** Azerbaijani UI and content

---

## 1. Supabase setup

The site shares one Supabase project with the gazette (originally the
`omni-law-gazette` project). It holds:

- `lesson_progress` — the guide's per-user lesson completion (migration in
  `supabase/migrations/20260912120000_lesson_progress.sql`, already applied);
- `issues`, `comments`, `admin_emails` and the public `gazette` storage bucket
  — the gazette's data, guarded by the `is_admin()` policy that checks the
  signed-in email against `admin_emails`.

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

### Gazette editors

Editors are the emails in `admin_emails`. An editor signs in with Google using
that same email, then opens `/gazette/admin` to publish, edit and moderate.
Existing editors add new ones from the **Redaktorlar** tab. The old gazette's
email-and-password sign-in is not used here.

---

## 2. Local development

```bash
npm install
cp .env.local.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev
```

Open <http://localhost:3000>. The landing page and the gazette (`/gazette`)
are public; `/courses`, `/account` and `/gazette/admin` require sign-in.
Without the two env vars the site still builds and runs, but shows a "setup
pending" notice instead of the Google button and an empty gazette.

`npm install` also copies the pdf.js worker into `public/` (see
`scripts/copy-pdf-worker.mjs`); the file is git-ignored.

`.npmrc` sets `legacy-peer-deps=true`: the Tailwind 3 / Vitest 4 dependency
graph trips npm's strict peer resolver otherwise. Vercel reads the same file.

Checks: `npm test` (loader tests), `npm run lint`, `npm run build`.

---

## 3. Deploy to Vercel

Reuse the existing **omnilawgazette** Vercel project rather than creating a
new one, so its hostnames and settings carry over:

1. **Project → Settings → Git**: disconnect `IsmayilSuleyman/omnilawgazette`
   and connect `IsmayilSuleyman/ismayil-huquq-beledchisi` (production branch
   `main`).
2. **Settings → Environment Variables**: the site reads
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and also
   accepts the old name `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for the key, so
   whatever the gazette project already has keeps working.
3. Optional: set `GAZETTE_HOSTS` to the hostnames that used to serve the
   standalone gazette (comma-separated, e.g.
   `omnilawgazette-ismayilsuleymans-projects.vercel.app`). Requests to `/` on
   those hosts redirect to `/gazette`; every other host lands on the guide.
4. Redeploy, then add the production hostname to the Supabase
   **Redirect URLs** (`https://<host>/auth/callback`) and to the Google
   client's **Authorized JavaScript origins**.

The gazette pages are public and indexable; only `/gazette/admin` is
`noindex`.

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
  gazette/page.tsx                Gazette library (masthead, latest issue, archive)
  gazette/[number]/page.tsx       Reading room: PDF viewer, prev/next, comments
  gazette/admin/page.tsx          Editor desk (publish, manage, editors)
  layout.tsx                      Root layout, fonts (Inter + Source Serif), theme script
  page.tsx                        Public landing page
  login/page.tsx                  Google sign-in card
  auth/callback/route.ts          OAuth code → session exchange
  courses/page.tsx                Course list with progress
  courses/[course]/page.tsx       Course page: lessons, stats, "continue"
  courses/[course]/[lesson]/      Lesson page (MDX) + completion action
  account/page.tsx                Profile and per-course progress
lib/
  gazette.ts                      Gazette types, public reads, storage URLs
  gazette-editor.ts               Server-only editor allow-list check
  gazette-format.ts               Azerbaijani date / size / relative-time helpers
  pdf-analyze.ts                  Page count + cover render for the publish flow
  content.ts                      File-based course/lesson loader
  progress.ts                     Completed-lessons reads and per-course maths
  auth-guard.ts                   requireUser()
  user.ts                         Profile fields from the Google identity
  supabase/                       Server, browser clients and env config
components/
  AppHeader (with the guide ↔ gazette switch pill), MobileTabBar, ThemeToggle,
  PageBackground, Wordmark, LessonBody (MDX render), CompleteToggle,
  ProgressBar, Skeleton, StatTile
  gazette/                        OmniLogo, IssueCard, LibraryExplorer, PdfViewer,
                                  Comments, DownloadButton, RegisterRead, admin/*
content/courses/                  Courses and lessons (MDX)
supabase/migrations/              lesson_progress table + policies
tests/                            Vitest: content loader
middleware.ts                     Auth gate for /courses and /account
```

## Roadmap

1. ✅ Design system, Google sign-in, file-based courses, lesson progress
   ✅ Omni Law Gazette folded in as the `/gazette` section
2. Private beta with a few readers; more courses
3. Tests and quizzes per lesson (MDX components + attempts table)
4. AI tutor grounded in the open lesson
5. Payments (merchant of record) and public launch
