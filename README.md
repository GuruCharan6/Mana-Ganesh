# Mana Ganesh

Offline-first PWA for a Ganesh Chaturthi youth committee to track chanda
(donations) and expenses as a shared, tamper-evident ledger. Any member with
access can log entries from the field, even offline; everyone sees the same
live numbers.

**Stack:** Next.js 15 (App Router, TypeScript, Tailwind v4) frontend +
FastAPI backend + Supabase (Postgres, Auth, Storage).

Auth is Google OAuth (not phone/OTP). Chanda and expense entries are
immutable — corrections happen via a comment plus an additive adjustment
entry, never an edit/delete.

---

## Repo layout

```
web/       Next.js frontend
api/       FastAPI backend
supabase/  SQL migrations (run 0001_init.sql against a fresh project)
assets/    Logo source art
```

---

## 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)
   — it's the full consolidated schema (tables + RLS policies).
3. **Enable Google OAuth**: Authentication → Providers → Google. You'll need
   a Google Cloud OAuth client (Web application type):
   - Authorized redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`
   - Paste the resulting Client ID + Secret into Supabase's Google provider config.
4. Under Authentication → URL Configuration, add your deployed frontend URL
   (e.g. `https://your-app.vercel.app`) to **Redirect URLs** — otherwise the
   OAuth callback will be rejected in production.
5. Create two Storage buckets (public read): `org-logos`, `expense-receipts`,
   `announcement-images` — see `supabase/migrations/_archive/000{3,5,6}_*.sql`
   for the exact bucket/policy definitions if you want to script it instead
   of using the dashboard.
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

## Known limitations (see `docs/SESSION_LOG.md` for full list)

- No automated tests — verified manually.
- No backend rate limiting — fine for a closed committee tool, not if the
  URL becomes public.
- PWA needs one online visit before it works offline (no cached app-shell
  for a true cold start).
- iOS install is manual (Share → Add to Home Screen), no in-app prompt.
