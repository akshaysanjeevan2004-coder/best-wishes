# Best Wishes - online mock-test platform

Real server-enforced exam engine: 4 sections x 25 questions, 15 minutes per section, automatic locking and
submission, server-side scoring, wrong-answer analysis, public results board, admin panel, PDF importer.

**Stack:** Next.js 14 (App Router) + TypeScript + Tailwind - Supabase PostgreSQL - Vercel (or any Node host).

> Start with **DEPLOY.md** (ZIP -> live website, step by step).

## How candidates use it
1. Open the site -> enter **name, mobile number, email** (required to enter).
2. See **today's tests** (max 2) -> Start test -> read instructions -> exam.
3. Sections lock automatically; at 60 minutes (or on Submit) the score + wrong answers appear.
4. Every finished attempt appears on the **Results board** (`/leaderboard`) for all registered candidates:
   name, test, score, right/wrong/skipped and **wrong answers in each section**. Mobile and email are never shown.
   People currently taking a test are shown too ("Taking a test right now").

## Conventions
- **Option index: 0 = A, 1 = B, 2 = C, 3 = D** - in the database, API and JSON. (The importer also accepts letters.)
- Question numbers are 1-based. Section = `floor((n-1)/25)+1`.
- Marking: `score = correct x correct_marks + wrong x wrong_marks` (`wrong_marks` is 0 or negative, e.g. -0.5). Set per paper.
- JSON paper format (`data/sample-paper.json`):
  ```json
  { "title": "...", "correct_marks": 1, "wrong_marks": 0,
    "questions": [ { "question_number": 1, "question_text": "...", "options": ["A","B","C","D"], "correct_option": 1 } ] }
  ```

## How the timer is enforced (it is NOT a frontend countdown)
| Layer | What it does |
|---|---|
| `attempts.started_at` | Written by the database clock when the candidate clicks Start. One attempt per candidate per paper (unique constraint), so refreshing never restarts anything. |
| `GET /api/attempts/:id` | Server computes `section = floor(elapsed/900)+1` from **its own clock**. Returns only the *current* section's questions - future sections and correct answers are never sent. |
| `POST .../answer` | Checks: owner -> attempt IN_PROGRESS -> exam not over -> question belongs to this paper -> question is in the section open *right now*. Otherwise HTTP 400/403. |
| DB trigger `answers_guard` | Re-checks the same rules inside PostgreSQL on every insert/update, so even a bug or a hand-crafted request cannot write to a locked section. |
| `finalize_attempt()` (SQL) | One transaction: locks the row, counts, scores, sets status. Idempotent - calling it twice returns the stored result. |
| Auto-submit | Whoever touches an expired attempt first (candidate refresh, results board, admin) triggers `AUTO_SUBMITTED`, with `submitted_at` clamped to the deadline. `finalize_expired()` sweeps all expired attempts whenever the board or dashboard loads. |
| Browser | Only draws the countdown (corrected by the server's clock offset), re-syncs every 20 s, on reconnect and when the tab becomes visible. Changing the PC clock changes nothing. |

Other security: Row-Level Security is on for every table with no policies (the public key can read nothing);
the service-role key lives only in server env vars; sessions are HMAC-signed HTTP-only cookies; admin password
compare is timing-safe; every id/option is validated server-side; candidates can only read their own attempt/result;
`/admin` pages and `/api/admin/*` both require the admin cookie.

## Project layout
```
app/(site)/        home, results board, candidate result page
app/exam/[paperId] full-screen exam
app/admin/         login + (panel): dashboard, papers/import, schedule, results, result detail
app/api/           register, daily, attempts[/id|/answer|/submit], results, leaderboard, admin/*
components/        ExamClient (exam UI), ImportPanel (PDF review/import), tables, forms
lib/               exam.ts (timing), validate.ts, parser.ts (PDF text -> questions), auth.ts, queries.ts, attempts.ts
scripts/           import_pdf.py (offline importer), e2e-test.mjs (live API/timer/security test)
supabase/          schema.sql (tables, RLS, triggers, functions), seed.sql (sample paper scheduled for today)
data/              sample-paper.json / .txt (100 questions, 4 sections x 25)
tests/             core.test.ts (unit tests)
```

## Testing
- `npm test` - unit tests: section boundaries (0/899/900/1799/.../3600 s), refresh math, parser on three PDF layouts,
  validation errors ("Question 47: Missing option C.").
- `node scripts/e2e-test.mjs` against a running copy (needs `BASE_URL`, `ADMIN_PASSWORD`; ~50 s). It imports a
  throw-away paper with **10-second sections**, then checks: admin login/logout protection, invalid paper rejected,
  third slot refused, register validation, single attempt on repeat start, no correct answers in API output,
  save/change/refresh, wrong/foreign/invalid ids, other candidate's attempt (404), real section transition,
  **locked-section write -> 403**, auto-submit at the deadline, idempotent submit, scoring with negative marking
  (2 correct, 1 wrong, 97 blank = 1.5), per-section stats, privacy of the public board, CSV export.
  Run it on a test database - it replaces today's slot 2.
- To test the timer by hand: import the sample JSON with "Seconds per section" = 20, schedule it, start it.

## Known limitations (be aware)
- **Identity is not verified**: there is no OTP. Anyone who types someone else's mobile number registers as that
  person (and could resume their attempt). Add SMS/email OTP (e.g. Supabase Auth) if results matter for ranking prizes.
- One attempt per candidate per paper (by design, for a fair board). To allow a retake, delete the attempt row.
- Scanned (image) PDFs need OCR first. Unusual PDF layouts need a fix in the review screen (the parser never guesses silently).
- Registration and login have no IP rate-limit beyond a short delay on failed admin logins; use Vercel's firewall if abused.
- Paper config (sections, per-section seconds) is stored per paper, but the importer and UI currently validate the 4 x 25 shape.
