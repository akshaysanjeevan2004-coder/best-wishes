# Best Wishes - step-by-step guide: from the ZIP to a live website (free)

Total time: about 30-40 minutes the first time. You need: a computer, an email address, and a free
account on GitHub, Supabase and Vercel. No credit card is needed for any of them.

---------------------------------------------------------------------------------------------------
## PART 0 - Install the tools once

1. **Node.js 18 or newer** (LTS): https://nodejs.org  -> download, install, accept defaults.
   Check it worked: open a terminal (Windows: "Command Prompt" or PowerShell; Mac: "Terminal") and run
   `node -v` -> it should print v18 or higher.
2. **Git**: https://git-scm.com/downloads (accept defaults). Check: `git --version`.
3. Create free accounts at https://github.com , https://supabase.com , https://vercel.com
   (on Vercel choose "Continue with GitHub" - it makes Part 5 easier).

---------------------------------------------------------------------------------------------------
## PART 1 - Unzip the project and install

1. Unzip `best-wishes.zip`. You get a folder `best-wishes`.
2. Open a terminal **inside that folder**
   - Windows: open the folder, click the address bar, type `cmd`, press Enter.
   - Mac: right-click the folder -> "New Terminal at Folder".
3. Run:
   ```
   npm install
   ```
   (takes 1-3 minutes).

---------------------------------------------------------------------------------------------------
## PART 2 - Create the database (Supabase)

1. Go to https://supabase.com/dashboard -> **New project**.
   - Name: `best-wishes`
   - Database password: click "Generate", save it somewhere (you will not need it again for this app).
   - Region: choose the one closest to your candidates (India -> **Mumbai / ap-south-1**).
   - Click **Create new project** and wait ~2 minutes.
2. Left menu -> **SQL Editor** -> **New query**.
   - Open `supabase/schema.sql` from the project folder in any text editor, copy everything, paste, click **Run**.
     You should see "Success. No rows returned".
   - New query again -> paste all of `supabase/seed.sql` -> **Run**. This adds the 100-question sample paper
     and schedules it for today as Paper 1, so you can test immediately.
3. Get the two values the app needs: left menu -> **Project Settings** (gear) -> **API** (or "API Keys"):
   - **Project URL**  (looks like `https://abcdxyz.supabase.co`)  -> this is `SUPABASE_URL`
   - **service_role** key (older UI, under "Project API keys") or the **Secret key** `sb_secret_...`
     (newer UI, "API Keys" page)  -> this is `SUPABASE_SERVICE_ROLE_KEY`
   - **Keep the service_role / secret key private.** Never put it in a public place or chat.
   - You do NOT need the anon/publishable key; the browser never talks to Supabase.

---------------------------------------------------------------------------------------------------
## PART 3 - Configure and run it on your computer

1. In the project folder copy the template:
   - Windows: `copy .env.example .env.local`
   - Mac/Linux: `cp .env.example .env.local`
2. Open `.env.local` in a text editor and fill in:
   ```
   SUPABASE_URL=https://abcdxyz.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<the secret key from Part 2>
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=<choose a strong password>
   ADMIN_SESSION_SECRET=<random 64 characters, see below>
   APP_TIMEZONE=Asia/Kolkata
   ```
   Generate the random secret (works on every OS):
   ```
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   Copy the printed text into `ADMIN_SESSION_SECRET`.
3. Start the site:
   ```
   npm run dev
   ```
4. Open http://localhost:3000
   - Enter a name / mobile / email -> you should see "Today's tests" with the sample paper -> try it.
   - Admin: http://localhost:3000/admin/login (username/password from `.env.local`).

Optional automatic checks (a few seconds): `npm test`
Full end-to-end + security test (~50 s; see "Testing" in README.md):
```
BASE_URL=http://localhost:3000 ADMIN_PASSWORD=yourpassword node scripts/e2e-test.mjs
```
(Windows PowerShell: `$env:ADMIN_PASSWORD="yourpassword"; node scripts/e2e-test.mjs`)

---------------------------------------------------------------------------------------------------
## PART 4 - Put the code on GitHub

1. https://github.com/new -> Repository name `best-wishes` -> **Private** -> Create repository
   (do NOT tick "Add a README").
2. In your terminal (project folder):
   ```
   git init
   git add .
   git commit -m "Best Wishes exam platform"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/best-wishes.git
   git push -u origin main
   ```
   `.env.local` is git-ignored, so your secrets are NOT uploaded. (Check: it must not appear on GitHub.)

---------------------------------------------------------------------------------------------------
## PART 5 - Deploy on Vercel (free)

1. https://vercel.com/new -> pick your `best-wishes` repository -> **Import**.
2. Framework Preset shows **Next.js** (leave as is). Do not change build settings.
3. Open **Environment Variables** and add these six (name -> value). Copy values from `.env.local`:
   | Name | Value |
   |---|---|
   | `SUPABASE_URL` | your Project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | your secret key |
   | `ADMIN_USERNAME` | `admin` (or your choice) |
   | `ADMIN_PASSWORD` | your admin password |
   | `ADMIN_SESSION_SECRET` | the 64-character random string |
   | `APP_TIMEZONE` | `Asia/Kolkata` |
4. Click **Deploy**. After ~2 minutes you get `https://best-wishes-xxxx.vercel.app`.
5. Test: open the URL -> register -> take the sample test. Admin at `/admin/login`.
6. Custom name: Vercel project -> **Settings -> Domains** to rename the free `.vercel.app` address
   (or add your own domain later).
7. Every `git push` to `main` redeploys automatically.

`vercel.json` pins the server region to Mumbai (`bom1`) so it sits next to a Mumbai Supabase database.
If you chose a different Supabase region, change `bom1` to a nearby Vercel region (e.g. `sin1` Singapore,
`fra1` Frankfurt, `iad1` US East).

---------------------------------------------------------------------------------------------------
## OTHER FREE HOSTS (instead of Vercel)

The app is a normal Node.js Next.js app, so any host that runs `npm run build` + `npm start` works.

**Render.com (free web service)**
1. New -> Web Service -> connect the GitHub repo.
2. Runtime: Node. Build command: `npm install && npm run build`. Start command: `npm start`.
3. Instance type: Free. Add the same six environment variables. Deploy.
4. Note: free Render services "sleep" after ~15 min without visitors; the first visit then takes ~30-60 s.

**Railway / Koyeb / Fly.io**: same commands and variables (free allowances change - check their pricing pages).

The database (Supabase) stays the same whatever host you use.

---------------------------------------------------------------------------------------------------
## DAILY USE (admin)

**Import a new paper**
1. `/admin/login` -> **Papers**.
2. Choose your PDF (text-based, up to 4 MB). The parser extracts questions, options and answers.
3. Read the **parser report**. Red numbers = questions that need a fix. Click a number, correct the text/options/answer.
   When the green box says "Ready: 100 questions, 4 sections x 25", click **Import paper**.
   Set "Marks per wrong answer" to e.g. `-0.5` if the paper has negative marking.
4. For big or awkward PDFs run the offline tool, then upload the JSON it makes:
   `pip install pypdf` then `python scripts/import_pdf.py paper.pdf -o paper.json --title "SSC CGL Shift 1"`

**Schedule two papers for a day**
1. **Schedule** -> pick Date, Slot "Paper 1", the paper -> Save.
2. Pick the same Date, Slot "Paper 2", another paper -> Save.
   A third paper on one date is impossible. Saving into an occupied slot replaces it.
   Candidates only see papers scheduled for *today* in the Asia/Kolkata timezone.

**See results**: **Results** -> filter by date/paper/name/min score -> click a candidate for the
question-by-question view -> **Download CSV**.

---------------------------------------------------------------------------------------------------
## FREE-TIER THINGS TO KNOW

- **Supabase free projects pause after 7 days with no activity.** Open the dashboard and click "Restore"
  (or visit the site regularly). Your data is kept.
- Vercel's free "Hobby" plan is for non-commercial use. If you start charging fees, move to a paid plan.
- If thousands of candidates start the same exam at the same minute, upgrade Supabase (Pro) for more connections.

## TROUBLESHOOTING

| Symptom | Fix |
|---|---|
| Page shows "Application error" / 500 | A variable is missing or wrong in Vercel -> Settings -> Environment Variables, then Redeploy. |
| "SUPABASE_URL ... are not set" | `.env.local` not filled (local) or variables missing (Vercel). |
| Admin login always fails | `ADMIN_PASSWORD` in Vercel differs from what you type; re-save and Redeploy. |
| "Today's tests" is empty | Nothing scheduled for today (Asia/Kolkata date). Admin -> Schedule. |
| PDF says "No text found" | Scanned PDF. Run OCR: `ocrmypdf in.pdf out.pdf`, then import `out.pdf`. |
| Parser report lists many problems | The PDF layout is unusual. Fix in the review screen, or send me a sample of the text and adapt `lib/parser.ts`. |
| Candidate cannot start: "not available today" | The paper isn't scheduled for today, or its slot was replaced. |
