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
- `card_reviews` — spaced-repetition state per flashcard
  (`supabase/migrations/20260912220000_card_reviews.sql`, already applied);
- `quiz_attempts` — every test submission with score, pass flag and the
  chosen answers (`supabase/migrations/20260912200000_quiz_attempts.sql`,
  already applied);
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
Git connection points at this repository, so every merge into `main` builds
and deploys on its own; nothing needs to be pushed anywhere else. The old
`IsmayilSuleyman/omnilawgazette` repository is no longer part of the deploy
path and only keeps the gazette's earlier history.

`.env.production` carries the public Supabase values, so no dashboard
variables are needed; dashboard variables override the file if you add them.
On `omnilawgazette.vercel.app`, point the redirect rule at
`https://ismayilhuquqbeledchisi.vercel.app/gazette` so old gazette links keep
working. Then add the production hostname to the Supabase **Redirect URLs**
(`https://<host>/auth/callback`) and to the Google client's **Authorized
JavaScript origins**.

## 4. Adding a course

### Flashcard decks ("Öyrən")

One JSON file per deck under `content/decks/`:

```json
{
  "title": "Hüquq anlayışı və hüququn əlamətləri",
  "description": "One line for the deck card.",
  "order": 1,
  "source": { "label": "Dərs: Hüquq anlayışı", "href": "/courses/huququn-esaslari/huquq-anlayisi" },
  "newPerDay": 15,
  "cards": [
    { "id": "c1", "front": "Sual", "back": "Cavab", "hint": "optional" }
  ]
}
```

Scheduling is SM-2 as in Anki (`lib/srs.ts`): four ratings, Yenidən /
Çətin / Yaxşı / Asan; good answers go 1 day, 6 days, then interval × ease;
"Yenidən" resets the card and brings it back within the session. A session
queues due cards (oldest first) then new cards up to `newPerDay`. The server
action recomputes the schedule from the stored state, so the browser cannot
forge it. Card ids are stable keys into `card_reviews`: renaming one orphans
its schedule.

### Study material on a law or legal act ("Mənbələr")

One MDX file per act under `content/sources/`, listed at `/resources` and
read at `/resources/<slug>`:

```md
---
title: Azərbaycan Respublikasının Mülki Məcəlləsi
kind: Məcəllə                 # groups the list: Konstitusiya, Məcəllə, Qanun ...
number: 779-IQ
adopted: 28 dekabr 1999
inForce: 1 sentyabr 2000
summary: One or two sentences for the card.
official: https://e-qanun.az/framework/46944   # link to the authoritative text
order: 2
---

## Quruluşu
...
```

The four starter materials (Konstitusiya, Mülki Məcəllə, Əmək Məcəlləsi,
"Normativ hüquqi aktlar haqqında" Konstitusiya Qanunu) were drafted as
illustrations of the intended register. Verify dates, numbers, article
references and the `official` links against e-qanun.az before relying on
them; each page carries that reminder for readers.

### Course

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

### Tests per lesson

A lesson gets a test when a JSON file with the lesson's slug sits in the
course's `quizzes` folder:

```
content/courses/<course-slug>/quizzes/<lesson-slug>.json
```

```json
{
  "pass": 70,
  "questions": [
    {
      "id": "q1",
      "prompt": "Sual mətni",
      "options": ["A", "B", "C", "D"],
      "answer": 1,
      "explanation": "Nə üçün belədir; dərsin hansı hissəsinə əsaslanır."
    }
  ]
}
```

`answer` is the index of the correct option, `pass` the percentage needed
(default 70). The answer key never reaches the browser: the page only sends
the prompts and options, a server action grades the submission, stores the
attempt in `quiz_attempts` and returns the explanations. Passing marks the
lesson completed. `npm test` checks every quiz file: valid shape, unique
option text, an explanation on every question, and a matching lesson.

Rules:

- Slugs are lowercase letters, digits and hyphens only. The numeric prefix on a
  lesson file (`01-`) only orders files in the editor; the URL uses the part
  after it. `order` in frontmatter wins when both are present.
- Progress rows reference slugs, so renaming a slug orphans the completion
  marks for that lesson.
- The starter course under `content/courses/huququn-esaslari` was written as
  an illustration of the intended register. Verify every article reference
  against the current text of the law before publishing it to paying users.
- `content/courses/konstitusiya` is the Constitution textbook: 26 lessons
  that follow the Constitution chapter by chapter (2016 wording), a test per
  lesson, and seven matching flashcard decks under `content/decks/`
  (`konstitusiya-*.json`). Article numbers, part numbers and the
  attribution of each change to the 2002, 2009 or 2016 referendum were
  checked against the text published on president.az and the three
  referendum acts; still re-verify against e-qanun.az before relying on a
  quotation.

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
  (guide)/courses/[course]/       Course page; [lesson]/ lesson page (MDX), test, completion
                                  and grading actions
  (guide)/account/page.tsx        Profile and per-course progress
  (guide)/learn/                  "Öyrən": flashcard decks with spaced repetition; [deck]/ a session
  (guide)/resources/              "Mənbələr": laws and acts with study materials; [slug]/ one act
  (gazette)/layout.tsx            Gazette chrome (original design), imports gazette.css
  (gazette)/gazette/              Library, issues/[number] viewer, admin
lib/
  gazette.ts                      Gazette issue reads for the landing page + /gazette URL
  gazette-format.ts               Azerbaijani date helpers
  gazette/                        Gazette's own Supabase clients, types, formatting, PDF analysis
  content.ts                      File-based course/lesson loader
  quiz.ts                         Test loader, validation and grading
  sources.ts                      Study-material loader for laws and acts
  decks.ts                        Flashcard deck loader
  srs.ts                          SM-2 scheduler (pure functions)
  progress.ts                     Completed lessons, best test scores, per-course maths
  auth-guard.ts                   requireUser()
  user.ts                         Profile fields from the Google identity
  supabase/                       Server, browser clients and env config
components/
  AppHeader (edge-to-edge, switch pill to the gazette), SectionMenu
  (Öyrən / Kurslar / Mənbələr dropdown), MobileTabBar, ThemeToggle,
  PageBackground, Wordmark, LessonBody (MDX render), CompleteToggle,
  ProgressBar, Skeleton, StatTile, LessonQuiz, FlashcardSession, gazette/OmniLogo
components/gazette/               Gazette UI: SiteHeader (pill back to /), IssueCard,
                                  LibraryExplorer, PdfViewer, Comments, admin/*
content/courses/                  Courses, lessons (MDX) and tests (JSON)
content/sources/                  Study materials on laws and legal acts (MDX)
content/decks/                    Flashcard decks (JSON)
scripts/                          pdf.js worker copy, gazette scraper and drafts
supabase/migrations/              lesson_progress, quiz_attempts, card_reviews + policies
tests/                            Vitest: content loader, tests, lesson compile, dates
middleware.ts                     Auth gate for /courses, /account, /learn, /resources
```

## Roadmap

1. ✅ Design system, Google sign-in, file-based courses, lesson progress
   ✅ Omni Law Gazette folded in at `/gazette`, original design, shared database
   ✅ Tests per lesson with saved attempts and best scores
   ✅ "Mənbələr": study materials on laws and legal acts
   ✅ "Öyrən": flashcards with Anki-style spaced repetition
   ✅ Constitution textbook: 26 lessons, tests and flashcard decks
2. Private beta with a few readers; more courses
3. AI tutor grounded in the open lesson
4. Payments (merchant of record) and public launch
