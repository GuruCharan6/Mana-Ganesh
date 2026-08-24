# Mana Ganesh

Offline-first PWA for a Ganesh Chaturthi youth committee to track chanda
(donations) and expenses as a shared, tamper-evident ledger. Any member with
access can log entries from the field, even offline; everyone sees the same
live numbers.

**Stack:** Next.js 15 (App Router, TypeScript, Tailwind v4) frontend +
FastAPI backend + Supabase (Postgres, Auth, Storage).

Auth is Google OAuth (not phone/OTP). Chanda, Expense, and Lucky Draw
entries are immutable for everyone except Admin — corrections normally
happen via a comment plus an additive adjustment entry, never an edit/delete;
Admin alone can directly edit or delete an entry when needed (no audit trail
kept, by design).

---

## Repo layout

```
web/       Next.js frontend
api/       FastAPI backend
supabase/  SQL schema (one consolidated migration file)
assets/    Logo source art
```

---

## 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)
   — the complete schema: every table, RLS policy, and Storage bucket the
   app needs, in one file. There's no migration history to walk through —
   this file is always kept as the single current end-state, updated in
   place as the schema evolves rather than layered with new files.
   **Only for a brand-new project** — an existing live project already has
   this schema applied incrementally; running it there would fail on
   `already exists` errors for every table.
3. **Enable Google OAuth**: Authentication → Providers → Google. You'll need
   a Google Cloud OAuth client (Web application type):
   - Authorized redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`
   - Paste the resulting Client ID + Secret into Supabase's Google provider config.
4. Under Authentication → URL Configuration, add your deployed frontend URL
   (e.g. `https://your-app.vercel.app`) to **Redirect URLs** — otherwise the
   OAuth callback will be rejected in production.
5. Storage buckets (`org-logos`, `expense-receipts`, `announcement-images`,
   `lucky-draw-qr`) are created automatically by the migration above — no
   manual dashboard step needed.
6. Grab these values from Project Settings → API / Auth:
   - `Project URL`
   - `anon` public key
   - `service_role` key (secret — backend only, never expose to the client)
   - JWT Secret (Settings → API → JWT Settings)

## 2. Local development

**Backend** (`api/`):

```bash
cd api
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
# fill in .env with your Supabase values (see step 1.6)
uvicorn app.main:app --reload --port 8000
```

**Frontend** (`web/`):

```bash
cd web
npm install
copy .env.example .env
# fill in .env — NEXT_PUBLIC_API_URL=http://localhost:8000 for local dev
npm run dev
```

Open `http://localhost:3000`.

---

## 3. Deploy

### Backend → Render

1. New → Web Service → connect this repo, root directory `api`.
2. Build command: `pip install -r requirements.txt`
3. Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Environment variables (Render dashboard → Environment):
   - `SUPABASE_URL`
   - `SUPABASE_JWT_SECRET`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `CORS_ORIGINS` — comma-separated list of allowed frontend origins, e.g.
     `https://your-app.vercel.app` (add `http://localhost:3000` too if you
     still want local frontend dev to hit the deployed backend)
5. Deploy. Note the resulting URL, e.g. `https://mana-ganesh-api.onrender.com`.

Render free-tier services sleep after inactivity — first request after idle
takes ~30-50s to wake up. Fine for a festival committee tool, worth knowing.

### Frontend → Vercel

1. New Project → import this repo, root directory `web`.
2. Framework preset: Next.js (auto-detected).
3. Environment variables (Project Settings → Environment Variables):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_API_URL` — the Render backend URL from above
4. Deploy. Note the resulting URL, e.g. `https://mana-ganesh.vercel.app`.

### Wire the two together

1. Go back to Render → update `CORS_ORIGINS` to include the real Vercel URL
   (if you didn't already know it in step 4 above) → redeploy.
2. Go back to Supabase → Authentication → URL Configuration → add the Vercel
   URL to Redirect URLs (step 1.4 above, if not already done).
3. In Google Cloud Console, add the Vercel URL as an Authorized JavaScript
   origin on the OAuth client (Supabase's own redirect URI stays as the
   `*.supabase.co/auth/v1/callback` one from step 1.3 — you don't add Vercel
   there).

---

## Keeping the backend warm

Render's free tier sleeps the backend after ~15 min idle (first request
after that takes 30-50s to wake up). To avoid that, set up a free external
cron to hit `GET /health` every minute — e.g. [cron-job.org](https://cron-job.org):
create an account, add a job pointed at `https://<your-render-url>/health`,
schedule it for 1-minute intervals.

---

## Known limitations

- No automated tests — verified manually.
- No backend rate limiting — fine for a closed committee tool, not if the
  URL becomes public.
- PWA needs one online visit before it works offline (no cached app-shell
  for a true cold start).
- iOS Safari has no install prompt API at all — install there is always
  manual (Share → Add to Home Screen). Android/Chrome shows a proactive
  "Install App" button on the login screen instead.
- Each member's installed home-screen icon is fixed at the time they
  install — if the org logo changes later, everyone who already installed
  has to uninstall and reinstall individually to pick up the new icon.
