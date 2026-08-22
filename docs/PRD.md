# Mana Vinayaka — Product Requirements Document

**Version:** v1.0
**Author:** Charan
**Stack:** Next.js 15 (App Router) + Supabase (Postgres + RLS + Storage) + FastAPI
**Type:** Offline-first Progressive Web App (PWA)
**AI/LLM usage:** None. This is a plain CRUD + ledger app by design.

---

## 1. Problem Statement

Every year, youth groups (mandals) organizing Ganesh Chaturthi collect donations ("Chanda") door-to-door and spend it on the festival (idol, decoration, anadanam/prasad, pandal, etc.). Today this is tracked in **physical notebooks** carried by multiple youth members independently. This creates real problems:

- No single source of truth — money data is scattered across multiple people's books
- No transparency — members and donors can't see totals, only whoever holds the book
- No accountability — no record of who collected what, who spent what, or when
- Errors/disputes are hard to resolve — no audit trail
- Reconciliation at the end of the festival is slow and error-prone

**Goal:** Build a shared, transparent, tamper-evident ledger app where any youth member can log donations and expenses from the field (even offline), and the entire group sees the same live numbers — total collected, total spent, and balance — at all times.

This is explicitly **not** an event-planning, scheduling, or AI-powered app. It is a **money accountability and coordination tool** for a youth group running a festival.

---

## 2. Goals

1. One person creates an Organization (mandal) and becomes its Admin.
2. Admin adds Youth Members to the organization.
3. Any Youth Member (with Full Access) can log Chanda (donations) and Expenses.
4. Every member sees the same live dashboard: total collected, total spent, balance, full transaction history.
5. Chanda and Expense entries are **immutable** — never edited or deleted. Corrections happen via comments + adjustment entries, preserving full history.
6. The app works **offline** for entry (critical — collection happens door-to-door with poor network), and syncs automatically when back online.
7. Admin can control per-member access (Full Access vs View Only).
8. Any member can post/edit/delete Announcements, visible to all on the home screen.
9. A "Daily Compliance" view helps Admin see who has logged entries today vs who hasn't, to catch backlog before it piles up.

## 3. Non-Goals (v1)

- No AI/OCR/chatbot features of any kind.
- No online payment collection (UPI/Razorpay) — chanda is collected as cash in the field, only logged in-app.
- No automated WhatsApp Business API thank-you messages — v1 uses a free `wa.me` click-to-send link only. WhatsApp Business API is an explicit **v2** item.
- No event scheduling, vendor management, or guest RSVP features — out of scope for v1.
- No editing or deleting of Chanda/Expense entries under any role, including Admin.

---

## 4. User Roles & Permissions

| Capability | Admin | Full Access Member | View Only Member |
|---|---|---|---|
| Create organization | ✅ (creator only) | ❌ | ❌ |
| Add/remove members | ✅ | ❌ | ❌ |
| Set member access level | ✅ | ❌ | ❌ |
| Add Chanda entry | ✅ | ✅ | ❌ |
| Add Expense entry | ✅ | ✅ | ❌ |
| Comment / add adjustment on any entry | ✅ | ✅ | ❌ |
| Edit/delete Chanda or Expense entry | ❌ (nobody can) | ❌ | ❌ |
| Post/edit/delete Announcement | ✅ | ✅ (any member's) | ❌ |
| View dashboard, full transaction history, announcements | ✅ | ✅ | ✅ |
| View Daily Compliance view | ✅ | ❌ (optional: could be visible to all — default admin-only) | ❌ |

Notes:
- **Default access for every newly added member is Full Access.** Admin can downgrade individuals to View Only at any time. Admin is always Full Access and cannot be downgraded.
- **Full transparency by design** — dashboard and transaction history are identical for every role; only *write* permissions differ.
- Any Full-Access member can comment/adjust **any** entry, not just their own — trust-based model, consistent with "any member can add announcements."

---

## 5. Core Modules

### 5.1 Organization & Membership

**Auth:** Supabase Auth, phone number + OTP (no passwords).

**Signup/login flow (same entry point for everyone):**
1. User opens app → enters mobile number → OTP verification.
2. On successful verification, app checks: is this number already a **pending member** in any `org_members` row?
   - **Yes** → auto-link this auth account to that row (status flips from `pending` to `joined`) → land directly in that org's Dashboard as a Full Access member. No separate "accept invite" step.
   - **No** → land on "Create your Organization" screen → becomes Admin of a new org.

**Adding a member (Admin only):**
1. Admin goes to Members → enters name + mobile number.
2. Creates an `org_members` row with `status = 'pending'` (no linked `user_id` yet).
3. When that person eventually signs up with the same number, their account auto-links and `status` flips to `joined`.

**Members list (Admin view) shows status per member:**
- **Joined** — has signed up and is active in the org
- **Pending** — added by admin, hasn't signed up yet
- Admin can **edit** a pending entry's phone number (e.g., fix a typo) or **remove** a pending entry entirely. Joined members can only have their access level changed or be removed (not edited), since they own their own account.

- Admin manages member list + access level toggle (Full Access / View Only)

### 5.2 Chanda (Donation) Ledger — Immutable
Fields per entry:
- Donor Name (required)
- Donor Mobile Number (required — used for thank-you message)
- Amount (required)
- Collected On (date — when actually collected in the field)
- Entered On (auto timestamp — when saved to app)
- Area/Address (optional)
- Book Reference (optional — page/slip number, for reconciliation with physical book)
- Comments (optional, freeform)
- Collected By (auto — logged-in member's ID)
- Org ID (auto)

Behavior:
- **No edit, no delete — ever.**
- Corrections happen by (a) adding a comment on the original entry, and (b) creating a new **adjustment entry** that references the original entry's ID, with a negative or corrected amount and a note explaining the correction. Both remain visible in history.
- Supports **batch entry mode**: a form/UI flow for quickly entering multiple donors in one sitting (e.g., digitizing a full book page after the day's collection round).

### 5.3 Expense Ledger — Immutable
Fields per entry:
- Category (enum: Groceries, Anadanam/Prasad, Decoration, Pandal, Idol, Miscellaneous — extensible list)
- Vendor/Payee Name
- Amount (required)
- Date
- Receipt Photo (optional — Supabase Storage upload)
- Comments (optional)
- Logged By (auto)
- Org ID (auto)

Behavior: same immutability + comment/adjustment-entry correction pattern as Chanda.

### 5.4 Dashboard (Home Screen)
Identical view for every member regardless of role:
- **Total Chanda Collected** (sum of all chanda entries + adjustments)
- **Total Expenses** (sum of all expense entries + adjustments)
- **Balance** (Total Chanda − Total Expenses)
- Full transaction history (chanda + expenses interleaved or tabbed), filterable by member/category/date
- Announcement feed (visible on home screen, per user preference)
- Link to Daily Compliance view (admin)

### 5.5 Announcements
- Any member (Full Access) can create, edit, or delete an announcement — including other members' posts (open trust-based model, per requirements).
- Fields: text body, optional image attachment, posted by, timestamp.
- Visible to **all members** (no targeted/subset visibility in v1).
- In-app feed only — no push notifications in v1.

### 5.6 Daily Compliance View (Admin)
- Shows, per day: which members collected chanda in the field (self-reported or inferred from `Collected On` vs `Entered On` gap) vs which members have zero entries logged for that day.
- Purpose: let Admin nudge members who are behind on digitizing their book before backlog grows.
- v1: simple table — Member | Entries Today | Last Entered On.

### 5.7 Offline Support (PWA)
- App shell + last-synced data cached locally (service worker + IndexedDB).
- Chanda/Expense entry forms work fully offline — saved to a local outbox queue.
- On regaining connectivity, queued entries auto-sync to Supabase in the background.
- No conflict resolution needed — entries are additive only (never overwrite), so simple queue-and-push is sufficient.
- UI should clearly indicate "Saved locally, will sync" vs "Synced" state per entry.

### 5.8 Organization Branding
- **Default state:** immediately after signup and org creation, the app uses the plain, neutral design system (Section — see companion design system doc) with a **default Ganesh motif** (a simple line-art Ganesh icon) as the placeholder mark in the header — reflects the app name "Mana Vinayaka" before any org has customized it.
- **Admin uploads a logo** (from Org Settings, prompted right after org creation but skippable) — image upload to Supabase Storage, stored as `organizations.logo_url`.
- **Once a logo exists, it replaces the default Ganesh placeholder** everywhere the org identity is shown: app header (all screens), Dashboard title area, login/org-switch screen (if a member belongs to multiple orgs later), and the PWA "Add to Home Screen" icon for that org's members going forward.
- Recommended upload constraints: square image, min 256×256px, PNG/JPG, max 2MB — cropped to a circle or rounded-square in the header consistently.
- If the admin removes the logo later, the app reverts to the **default Ganesh placeholder** — never breaks or shows a blank image.
- **Implementation note for the coding assistant:** since this is a multi-tenant app under one domain, per-org PWA manifest icons need a dynamically generated manifest route (e.g., `/api/manifest/[orgId]`) rather than a single static `manifest.json`, if per-org home-screen icons are wanted at install time. In-app header/dashboard branding (the primary requirement here) does **not** need this — it's just conditional rendering of `logo_url` vs. a default placeholder component. Ship in-app branding first; treat the dynamic manifest/install-icon as a stretch item if time allows.

### 5.9 Thank-You Message (v1 scope — manual, free)
- After a Chanda entry is saved, show a **"Send Thank You"** button.
- Tapping it opens a `wa.me` deep link with the donor's number and a pre-filled message:
  `https://wa.me/91<mobile>?text=<url-encoded thank-you message with donor name and amount>`
- This opens the member's own WhatsApp app — they tap send. No API, no cost, no backend integration required.
- **v2 (explicitly out of scope for this build):** WhatsApp Business API for automated, branded thank-you messages. Flag this as a future integration point in the codebase (e.g., a stubbed `notifyDonor()` function) but do not implement it now.

---

## 6. Data Model (Supabase / Postgres)

```sql
-- Organizations
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text, -- null = use default placeholder mark
  created_by uuid references auth.users(id) not null,
  created_at timestamptz default now()
);

-- Members (join table: user <-> org, with role/access)
create table org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  user_id uuid references auth.users(id), -- null until they sign up and auto-link (status = pending)
  name text not null,
  mobile_number text not null,
  status text not null default 'pending' check (status in ('pending', 'joined')),
  role text not null default 'member' check (role in ('admin', 'member')),
  access_level text not null default 'full' check (access_level in ('full', 'view_only')),
  added_by uuid references auth.users(id),
  created_at timestamptz default now(),
  unique(org_id, mobile_number)
);

-- Chanda entries (immutable)
create table chanda_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  donor_name text not null,
  donor_mobile text not null,
  amount numeric(10,2) not null,
  collected_on date not null,
  entered_on timestamptz default now(),
  area text,
  book_reference text,
  collected_by uuid references auth.users(id) not null,
  adjustment_for uuid references chanda_entries(id), -- null unless this is a correction entry
  created_at timestamptz default now()
);

-- Comments on chanda entries
create table chanda_comments (
  id uuid primary key default gen_random_uuid(),
  chanda_entry_id uuid references chanda_entries(id) not null,
  commented_by uuid references auth.users(id) not null,
  comment text not null,
  created_at timestamptz default now()
);

-- Expense entries (immutable)
create table expense_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  category text not null,
  vendor_name text,
  amount numeric(10,2) not null,
  expense_date date not null,
  receipt_url text, -- Supabase Storage path
  logged_by uuid references auth.users(id) not null,
  adjustment_for uuid references expense_entries(id),
  created_at timestamptz default now()
);

-- Comments on expense entries
create table expense_comments (
  id uuid primary key default gen_random_uuid(),
  expense_entry_id uuid references expense_entries(id) not null,
  commented_by uuid references auth.users(id) not null,
  comment text not null,
  created_at timestamptz default now()
);

-- Announcements
create table announcements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  posted_by uuid references auth.users(id) not null,
  body text not null,
  image_url text,
  created_at timestamptz default now(),
  updated_at timestamptz,
  edited_by uuid references auth.users(id)
);
```

**Row-Level Security (RLS):** every table scoped by `org_id` — a user can only read/write rows belonging to orgs they're a member of (via `org_members`). Insert policies for `chanda_entries` / `expense_entries` / `announcements` require `access_level = 'full'` (or role = 'admin'). No update/delete policies exist at all for `chanda_entries` and `expense_entries` (enforce immutability at the database level, not just app level).

---

## 7. API Endpoints (FastAPI)

```
Auth (via Supabase Auth — FastAPI validates JWT)

POST   /orgs                          Create organization
GET    /orgs/{org_id}                 Get org details
PATCH  /orgs/{org_id}/logo            Upload/replace org logo (admin only)
DELETE /orgs/{org_id}/logo            Remove logo, revert to placeholder (admin only)
POST   /orgs/{org_id}/members         Add member as pending (admin only) — name + mobile_number
PATCH  /orgs/{org_id}/members/{id}    Update member access_level, or fix pending member's name/mobile (admin only)
DELETE /orgs/{org_id}/members/{id}    Remove a member (pending or joined; admin only)
GET    /orgs/{org_id}/members         List members with status (pending/joined)
POST   /auth/link-pending-member      Called post-OTP-verification — auto-links auth account to matching pending org_members row by mobile_number, flips status to 'joined'

POST   /orgs/{org_id}/chanda          Create chanda entry (full access only)
POST   /orgs/{org_id}/chanda/batch    Batch-create chanda entries
GET    /orgs/{org_id}/chanda          List chanda entries (filterable: member, date range)
POST   /chanda/{id}/comments          Add comment
POST   /chanda/{id}/adjust            Create adjustment entry referencing original

POST   /orgs/{org_id}/expenses        Create expense entry (full access only)
GET    /orgs/{org_id}/expenses        List expense entries
POST   /expenses/{id}/comments        Add comment
POST   /expenses/{id}/adjust          Create adjustment entry referencing original

GET    /orgs/{org_id}/dashboard       Totals: collected, spent, balance
GET    /orgs/{org_id}/compliance      Daily compliance view (admin)

POST   /orgs/{org_id}/announcements       Create announcement
PATCH  /announcements/{id}                Edit (any full-access member)
DELETE /announcements/{id}                Delete (any full-access member)
GET    /orgs/{org_id}/announcements       List
```

---

## 8. Screens (Frontend)

1. **Sign up / Login** — Supabase Auth (phone or email)
2. **Create Organization** (first-time flow) — name, optional details
3. **Upload Org Logo** (prompted after org creation, skippable) — shows default Ganesh placeholder until set
4. **Home Dashboard** — totals, transaction list, announcement feed, quick-add buttons
5. **Add Chanda** — single entry form + "Batch Entry" mode for multiple donors
6. **Add Expense** — form with category dropdown + receipt photo upload
7. **Transaction Detail** — view single entry + its comments/adjustment history
8. **Announcements** — feed + create/edit post
9. **Members** (admin) — list with Pending/Joined status, add member, edit/remove pending entries, toggle access level
10. **Daily Compliance** (admin) — table of member activity today
11. **Offline indicator** — small persistent banner/badge when entries are queued and unsynced

---

## 9. Tech Stack

- **Frontend:** Next.js 15 (App Router), PWA via `next-pwa` or manual service worker + manifest
- **Backend:** FastAPI (Python), same pattern as CareCircle
- **Database:** Supabase Postgres with Row-Level Security
- **Storage:** Supabase Storage (receipt photos)
- **Auth:** Supabase Auth (phone OTP recommended, given target users)
- **Offline storage:** IndexedDB (via a lightweight wrapper like `idb` or `Dexie.js`) for the outbox queue
- **Hosting:** Vercel (frontend) — consistent with CareCircle's `*.vercel.app` pattern
- **No LLM/AI dependencies of any kind.**

---

## 10. Implementation Plan (Phased)

### Phase 0 — Setup
- Supabase project, schema migration (Section 6), RLS policies
- Next.js app scaffold with PWA manifest + service worker
- FastAPI backend scaffold with Supabase JWT auth middleware

### Phase 1 — Org & Membership
- Sign up / login flow
- Create organization (default Ganesh placeholder branding)
- Logo upload flow (Org Settings, skippable at creation)
- Add members + access level management (admin)

### Phase 2 — Chanda Ledger
- Single entry form
- Batch entry mode
- List/detail view
- Comments + adjustment entry flow
- Offline queue + sync for chanda entries specifically (highest priority for offline, since field collection is the primary offline use case)

### Phase 3 — Expense Ledger
- Entry form + receipt upload
- List/detail view
- Comments + adjustment entry flow

### Phase 4 — Dashboard
- Totals calculation (live query or materialized view)
- Full transaction history with filters
- Daily Compliance view

### Phase 5 — Announcements
- Feed, create/edit/delete, image attachment

### Phase 6 — Offline Polish
- Extend offline queue to expenses + announcements
- Sync status indicators throughout UI
- Conflict-free sync testing (multiple members offline simultaneously)

### Phase 7 — Thank-You Link
- `wa.me` deep link generation + "Send Thank You" button on chanda entry save

### v2 (Not in this build)
- WhatsApp Business API integration for automated thank-you messages
- Push notifications for announcements
- Multi-year org history / year-over-year comparison

---

## 11. Key Design Principles (for the coding assistant to preserve)

1. **Immutability is non-negotiable.** Never implement UPDATE or DELETE endpoints/UI for `chanda_entries` or `expense_entries`. Corrections are always additive (comment + adjustment entry).
2. **Transparency by default.** Every role sees the same dashboard and transaction data. Only write permissions differ by access level.
3. **Offline-first for entry, online for everything else.** Prioritize making the Chanda entry form work flawlessly offline before polishing other screens.
4. **No AI.** Do not suggest or add OCR, chatbots, auto-categorization, or any LLM-based feature — this is intentional, not an oversight.
5. **Simplicity over cleverness.** This app is for a youth group during a busy festival — every screen should be usable by a non-technical person in under 30 seconds.
