# Mana Ganesh — Build Session Log

Everything built in this session, in order, with every deviation from the
original PRD called out explicitly. Read this before continuing the build —
several requirements below **override** what `docs/PRD.md` and
`docs/design-system.md` originally specified.

**App name:** "Mana Ganesh" (renamed from "Mana Vinayaka" — browser tab,
PWA install name, login screen, FastAPI title all updated).

---

## Stack (unchanged from PRD)

- Frontend: Next.js 15.5.23 (App Router, TypeScript, Tailwind v4), in `web/`
- Backend: FastAPI, in `api/` (Python 3.12, venv at `api/.venv`)
- DB/Auth/Storage: Supabase (Postgres + RLS + Storage)
- Dev command: `npm run dev` in `web/` uses `--turbopack` (added for faster
  startup — production `npm run build` still uses webpack; if you build
  while the turbopack dev server is running they can clash in `.next` and
  throw a `MODULE_NOT_FOUND` — just `rm -rf .next` and rebuild, harmless)

### Credentials (already configured, do not need re-setup)

- `web/.env` — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `NEXT_PUBLIC_API_URL`
- `api/.env` — `SUPABASE_URL`, `SUPABASE_JWT_SECRET`,
  `SUPABASE_SERVICE_ROLE_KEY`
- Auth: **Google OAuth**, not phone/Twilio (see Phase 1 deviation below).
  Google Cloud OAuth client already configured, Supabase Google provider
  already enabled.

---

## Database

**Run [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql)
against a fresh project — it's the single consolidated schema** (originally
9 incremental files, merged into one this session; the old files are kept
for history in `supabase/migrations/_archive/` but are superseded). Your
current live Supabase project already has everything in it — no need to
re-run anything there.

Tables: `organizations`, `org_members`, `chanda_entries`, `chanda_comments`,
`expense_entries`, `expense_comments`, `announcements`, `chanda_pledges`.

Key facts a future session needs to know:

- **`chanda_entries` and `expense_entries` have zero UPDATE/DELETE RLS
  policies, on purpose** — with RLS enabled and no such policy, Postgres
  rejects those statements outright. This is the immutability guarantee.
  Corrections only ever happen via a comment + a new **adjustment entry**
  (`adjustment_for` FK, additive only).
- **`chanda_pledges` is deliberately mutable** (`pending` → `resolved`) — it's
  a to-do list for donor promises, not the financial ledger. Resolving a
  pledge *inserts* a new row into `chanda_entries` (never edits) and marks
  the pledge done.
- Login identity is **email**, not phone — `org_members.email` is the unique
  key per org, `mobile_number` is optional free-text contact info only.
- `chanda_entries.donor_mobile` and `chanda_pledges.donor_mobile` are both
  nullable — donors can decline to share a number.
- `chanda_entries.item_description` (nullable) + `pledge_id` (nullable FK)
  support in-kind donations — see Pledges section below.
- Backend writes always go through **FastAPI with the service-role key**,
  bypassing RLS deliberately — every write endpoint re-implements the
  equivalent authorization check in Python (`api/app/authz.py`). RLS is
  defense-in-depth, not the only gate. Reads in Server Components go
  directly through Supabase with the user's session (RLS-respecting).

---

## Phase-by-phase status vs. the original PRD plan

### Phase 0 — Setup ✅ done, with deviations
- Next.js 15 pinned (scaffolder defaults to 16 now, downgrade needed).
- Tailwind v4 (`@theme` in `globals.css`) instead of `tailwind.config.js` —
  the framework changed since the PRD was written.
- **Fonts consolidated to Inter only.** The design system originally
  specified Fraunces (display) + IBM Plex Mono (amounts) + Inter (body).
  User explicitly asked to drop the serif/mono treatment — `--font-display`
  and `--font-mono` in `globals.css` both now just equal `--font-sans`.
  Component classes (`font-display`, `font-mono`) are still applied
  throughout the codebase for *semantic* correctness (so re-enabling real
  typefaces later is a two-line change in `globals.css`, not a full
  re-audit) — they just currently render as Inter.
- **Type-scale sizes converted from px to rem** (exact same visual sizes,
  just accessibility-respecting units) — see Font audit section below.
- PWA shell: service worker only caches static assets (manifest, icons),
  deliberately **not** navigation/HTML — most routes are server-rendered
  auth redirects, and caching those causes a real bug (hit it once this
  session: SW served stale cached `/` and broke the whole auth redirect
  chain). Full offline capability comes from the IndexedDB outbox, not the
  SW.
- App icon: **the Ganesh silhouette JPEG the user dropped in `docs/`** was
  converted to PNG at 192/512/apple-touch sizes (`web/public/icons/`) and
  wired into the manifest, page metadata, and `OrgBrandMark`'s default
  fallback. This is now the default org logo everywhere.

### Phase 1 — Org & Membership ✅ done, with a major deviation
- **Auth is Google OAuth, not phone+OTP.** Twilio trial-account SMS was a
  dead end (template restrictions + verified-caller-ID requirement made it
  unusable without a paid/upgraded account). Tried Supabase email-OTP as a
  middle step, then the user asked for full Google OAuth instead — one
  "Continue with Google" button, `/auth/callback` route exchanges the code
  for a session.
- **Backend JWT verification supports both** legacy HS256 (static secret)
  and modern asymmetric ES256/RS256-via-JWKS, since Google-authenticated
  users get asymmetric tokens on newer Supabase projects — `api/app/auth.py`
  tries HS256 first, falls back to JWKS. This was a real bug hunt this
  session (401s with no clear cause) — fixed, documented in code comments.
- Org creation, skippable logo upload, admin member management — as
  specified, but member matching is by **email**, not phone.
- **RLS bug found and fixed mid-build**: the original `org_members` INSERT
  policy had `is_org_admin(org_id) OR added_by = auth.uid()` — the second
  clause is always true for a self-authored insert, so any member
  (including view-only) could've inserted arbitrary rows. Fixed with two
  narrow policies (creator bootstrap vs. admin-adds-pending). Already
  folded into the consolidated `0001_init.sql`.
- **Multi-admin support added** (not in original PRD, which assumed exactly
  one un-demotable admin). Any existing admin can promote a Full Access
  member to admin (`PATCH /orgs/{id}/members/{id}` with `role`), or demote
  one back — blocked only if it would leave the org with **zero** admins
  (`authz.count_admins`).

### Phase 2 — Chanda Ledger ✅ done, extended significantly
- Single entry + batch entry (now **merged into one screen** — see UI
  restructure below, batch is a mode toggle, not a separate route).
- Offline-first via IndexedDB outbox (`web/src/lib/offline/`) — generalized
  in Phase 6 to cover more than just chanda (see below).
- Comments + adjustment-entry corrections, per the immutability model.
- **Donor mobile number is optional** everywhere (some donors decline).

### Phase 3 — Expense Ledger ✅ done as specified
- Entry form + receipt upload (Supabase Storage, `expense-receipts` bucket).
- Same comment/adjustment correction pattern as chanda.
- Deliberately **online-only** in Phase 3 scope (offline added in Phase 6).

### Phase 4 — Dashboard ⚠️ significantly restructured after initial build
The PRD's single "Dashboard = totals + full history + announcements +
compliance link" screen was built, then **taken apart** across several
later requests into what's now:
- **Home tab** = "Today" (chanda+expense entries actually logged today, by
  entered timestamp) + Announcements feed preview. No totals here anymore.
- **History tab** (separate nav item) = the full filterable transaction
  timeline (member/type/date filters), sorted by the transaction's own
  **collected/expense date** (not entered timestamp — this flipped twice
  this session, collected-date-order is the final answer).
- **Settings page** (gear icon in header, admin-only) = Collected/Spent
  totals (Balance was explicitly **removed from the UI entirely**, not
  shown anywhere) + org rename + org photo upload + collapsible Members
  section.
- **Daily Compliance** (`/org/[orgId]/compliance`) still exists and works,
  but is **unlinked from all navigation** — no button/tab points to it
  anymore, reachable only by typing the URL directly. Left this way
  deliberately per explicit request; re-link it if wanted back.

### Phase 5 — Announcements ✅ done as specified
- Full CRUD, open trust model (any Full Access member can edit/delete
  anyone's post). Shows at the top of Home whenever any exist.

### Phase 6 — Offline Polish ✅ done, generalized architecture
- Outbox generalized from chanda-only to a single `OutboxRecord` type
  covering 7 kinds: chanda create, expense create, announcement create,
  chanda comment, chanda adjust, expense comment, expense adjust.
- Sync engine (`web/src/lib/offline/sync.ts`) processes the queue FIFO,
  per-kind dispatch, retries on next trigger if it fails.
- Pledges (see below) are **not** in the offline outbox — pledge
  create/resolve are direct online API calls. If offline, the UI shows an
  explicit "needs a connection" error rather than silently queuing.

### Phase 7 — Thank-You Link ✅ done, message format changed twice
- Pure `wa.me` deep link, no API, per PRD scope.
- Final message format: `"Namaste Sir/Madam {donor}! 🙏 Thank you for your
  generous chanda of {amount or item} for Ganesh Chaturthi. Your support
  means a lot to us.\n\n- {org name}"` — includes the item name for in-kind
  gifts, signs off with the org's name.

---

## Features built beyond the original PRD

### In-kind donations + Pledges ("Reminders")
Not in the original PRD at all — added mid-session because donors
sometimes give rice/oil/groceries instead of (or in addition to) cash, and
sometimes *promise* something for later rather than handing it over on the
spot.

- **Chanda entry form** (`chanda/new/page.tsx`) has an optional "What are
  they giving?" field. If filled, a toggle appears: **"Received now"** vs.
  **"Promised for later."**
  - Received now → normal chanda entry, `item_description` set, shows an
    "In-Kind" tag everywhere.
  - Promised for later → creates a row in `chanda_pledges` instead (via
    `POST /orgs/{id}/pledges`), nothing hits the ledger yet.
- **Reminders** (bell icon in header, Admin + Full Access) — lists
  outstanding pledges. Each resolves two ways:
  - **"Collected"** → optional estimated ₹ value, creates a chanda entry
    with `item_description` + `pledge_id` set.
  - **"Got Cash Instead"** → required ₹ amount, creates a chanda entry that
    *still carries the original promised item* in `item_description` (so
    "promised rice, paid cash" isn't lost) — shows as `₹200` stacked over
    `(2 rice bags)` in the amount column, reusing the same display as
    "collected with a value," not a new format.
- **`AmountOrItem` component** (`web/src/components/AmountOrItem.tsx`)
  handles all three display cases for a chanda row's amount column:
  item-only (amount=0), amount-only (no item), or amount+item stacked.
  Used everywhere a chanda amount renders (Chanda list, History, Home).
- Reminders creation form was **removed** partway through — pledge
  creation only happens via the Chanda "+ Add" form's toggle now, Reminders
  is pure tracking + resolve.

### Multi-admin
Covered above under Phase 1.

### Org self-service (Settings page)
Org rename, photo upload — none of this existed in the original PRD's
onboarding-only branding flow. Now editable anytime from Settings.

---

## UI/UX decisions that overrode the design system doc

The design system doc (`docs/design-system.md`) specifies Fraunces/mono
fonts and a durva-green/sindoor-red money-coding convention. Both were
**explicitly overridden** by the user this session:

1. **No more green/red money coding.** `durva`/`sindoor` are no longer used
   for chanda-vs-expense amount color. All amounts render in plain `ink`.
   No `+`/`−` prefix sign either — that convention was tried and explicitly
   reverted. Chanda vs. expense is now distinguished only by context (which
   screen/tab) or the small `TxnTag` pill ("Chanda"/"Expense", neutral
   peacock/ink-muted colors, not durva/sindoor) shown in History/Home rows.
2. **Fonts consolidated to Inter**, per Phase 0 deviation above.
3. **Type-scale tokens converted px → rem** in `globals.css` — exact same
   visual sizes at default zoom, but now respect OS/browser text-size
   accessibility settings. Ran a full audit this session: found and fixed 5
   places using arbitrary `text-[Npx]` instead of the real tokens
   (`TxnTag`, `PledgeRow`, chanda list's In-Kind tag, `OrgNav` label/icon).
   Everything now uses the named tokens (`text-display-xl`, `text-heading-1`,
   `text-badge`, etc.) — no invented sizes anywhere except one deliberate,
   documented exception (the ₹ nav-icon glyph, which isn't prose text).
4. **Bottom nav is icon+label**, not the original PRD screen list — 4 tabs:
   Home, Chanda, Expenses, History. Chanda's icon is a literal ₹ glyph
   (changed from an abstract path), Home is a house icon (changed from an
   abstract dashboard icon).
5. Header no longer shows a role badge (ADMIN/View Only pill was removed
   per explicit request) — just org logo + name + Welcome line + the
   Reminders/Settings icons for those with access.

---

## Known issues / open questions for next session

1. **A data-entry mystery, not a code bug**: a chanda entry was found with
   amount `2989.0` in the database when the user says they typed `3000`.
   Traced the entire save path (form → outbox → API → insert) and found no
   transformation bug — the stored value genuinely is what was inserted.
   Likely just a typo, but flagging in case it recurs; if it does, it's
   worth instrumenting the outbox write itself (log the exact payload
   before `addToOutbox`) to catch it in the act.
2. **`docs/PRD.md` and `docs/design-system.md` are now stale** in several
   places (see deviations above) — worth updating them to match reality, or
   at minimum treating this file as the authoritative override until they're
   updated.
3. No automated tests anywhere — everything verified by manual click-through
   (mine where buildable/testable without real auth, user's for anything
   requiring a live Google login).
4. PWA cold-start gap still open: if a phone is offline before ever opening
   the app once, it won't load (no cached app-shell HTML). Fine if opened
   online first.
5. No rate limiting on the FastAPI backend — acceptable for a closed
   festival-committee tool, not if the URL ever becomes public.
6. iOS install is manual (Share → Add to Home Screen), no in-app prompt.

---

## File inventory (for orientation, not exhaustive line-by-line)

**Backend** (`api/app/`): `main.py`, `config.py`, `auth.py` (JWT verify,
dual HS256/JWKS), `authz.py` (role/access checks + `count_admins`),
`supabase_admin.py` (service-role client), `schemas.py` (all Pydantic
models), `routers/orgs.py`, `routers/chanda.py`, `routers/expenses.py`,
`routers/pledges.py`, `routers/announcements.py`, `routers/dashboard.py`.

**Frontend routes** (`web/src/app/`): `login`, `auth/callback`,
`onboarding/create-org`, `onboarding/logo`, `org/[orgId]/` (layout + Home),
`.../chanda` (list + `new` [single+batch] + `[chandaId]` detail),
`.../expenses` (list + `new` + `[expenseId]` detail), `.../transactions`
(History), `.../announcements`, `.../reminders`, `.../settings`,
`.../compliance` (unlinked).

**Shared components** (`web/src/components/`): `AmountText`, `AmountOrItem`,
`TxnTag`, `PledgeRow`, `OrgBrandMark`, `OrgNav`, `RemindersLink`,
`SettingsLink`, `OfflineBanner`, `ThankYouButton`, `ui/Button`, `ui/Badge`,
`ui/SyncBadge`.

**Offline system** (`web/src/lib/offline/`): `db.ts` (IndexedDB schema,
`OutboxRecord` type), `outbox.ts` (CRUD), `sync.ts` (dispatch/push per
kind), `useOutboxSync.ts` (React hook).

**Other lib** (`web/src/lib/`): `api.ts`/`api-server.ts` (fetch wrappers),
`format.ts` (currency/date formatting), `whatsapp.ts` (thank-you link
builder), `useOrgTransactions.ts` (merges chanda+expense for History/Home),
`useOrgName.ts`, `expenseCategories.ts`, `supabase/client.ts` +
`supabase/server.ts` + `supabase/middleware.ts`.
