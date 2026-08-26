-- Mana Ganesh — consolidated schema (end-state as of 2026-08-25).
-- This single file replaces every previous migration (0001–0006, which
-- themselves replaced an even earlier 0001–0009 set). Run this once against
-- a fresh Supabase project. There is no migration history to preserve here —
-- this is always the one true schema file.

-- ============================================================================
-- Tables
-- ============================================================================

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text, -- null = use default placeholder mark
  lucky_draw_ticket_price numeric(10,2), -- null until Admin sets one in Settings
  lucky_draw_qr_url text, -- uploaded payment QR image, shown on chanda + lucky draw entry forms
  created_by uuid references auth.users(id) not null,
  created_at timestamptz default now()
);

create table org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  user_id uuid references auth.users(id), -- null until they sign up and auto-link (status = pending)
  name text not null,
  mobile_number text, -- optional free-text contact info; login identity is email
  email text not null,
  status text not null default 'pending' check (status in ('pending', 'joined')),
  role text not null default 'member' check (role in ('admin', 'member')),
  access_level text not null default 'full' check (access_level in ('full', 'view_only')),
  added_by uuid references auth.users(id),
  created_at timestamptz default now(),
  unique(org_id, email)
);

-- In-kind chanda pledges (rice, oil, groceries — or plain cash — promised but
-- not yet collected). Unlike chanda_entries, this table is deliberately NOT
-- immutable — a pledge is a to-do/reminder, not a financial record. It
-- becomes part of the permanent, immutable ledger only when resolved:
-- resolving inserts a new chanda_entries row (additive) and marks the pledge
-- done. Nothing in chanda_entries is ever edited by a non-admin.
-- Created before chanda_entries so chanda_entries.pledge_id can reference it;
-- its own resolved_chanda_entry_id FK is added further down, once
-- chanda_entries exists.
create table chanda_pledges (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  donor_name text not null,
  donor_mobile text, -- optional — some donors decline to share a number
  item_description text, -- null = plain cash promised for later, no item involved
  promised_on date not null default current_date,
  area text,
  book_reference text,
  promised_amount numeric(10,2), -- informational only; resolving asks for the actual value
  status text not null default 'pending' check (status in ('pending', 'resolved')),
  resolved_chanda_entry_id uuid,
  created_by uuid references auth.users(id) not null,
  created_at timestamptz default now()
);

create table chanda_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  donor_name text not null,
  donor_mobile text, -- optional — some donors decline to share a number
  amount numeric(10,2) not null default 0,
  collected_on date not null,
  entered_on timestamptz default now(),
  area text,
  book_reference text,
  item_description text, -- null = cash entry; set = in-kind (direct entry or resolved pledge)
  payment_method text check (payment_method in ('cash', 'qr')),
  pledge_id uuid references chanda_pledges(id), -- set when this entry resolved a pledge
  collected_by uuid references auth.users(id) not null,
  adjustment_for uuid references chanda_entries(id) on delete set null, -- null unless this is a correction entry
  thank_you_sent_at timestamptz, -- set the instant Admin/Full Access taps Send Thank You
  created_at timestamptz default now()
);

alter table chanda_pledges
  add constraint chanda_pledges_resolved_entry_fkey
  foreign key (resolved_chanda_entry_id) references chanda_entries(id) on delete set null;

create table chanda_comments (
  id uuid primary key default gen_random_uuid(),
  chanda_entry_id uuid references chanda_entries(id) on delete cascade not null,
  commented_by uuid references auth.users(id) not null,
  comment text not null,
  created_at timestamptz default now()
);

create table expense_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  category text not null,
  vendor_name text,
  amount numeric(10,2) not null,
  expense_date date not null,
  receipt_url text, -- Supabase Storage path
  logged_by uuid references auth.users(id) not null,
  adjustment_for uuid references expense_entries(id) on delete set null,
  created_at timestamptz default now()
);

create table expense_comments (
  id uuid primary key default gen_random_uuid(),
  expense_entry_id uuid references expense_entries(id) on delete cascade not null,
  commented_by uuid references auth.users(id) not null,
  comment text not null,
  created_at timestamptz default now()
);

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

-- Lucky Draw — a fully separate ledger, never merged into chanda/expense
-- totals, history, or the Home "Today" feed. One row per ticket (not per
-- purchase), since each ticket is its own draw entry.
create table lucky_draw_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  buyer_name text not null,
  buyer_mobile text,
  buyer_address text,
  amount numeric(10,2) not null,
  payment_method text not null check (payment_method in ('cash', 'qr')),
  sold_by uuid references auth.users(id) not null,
  receipt_sent_at timestamptz, -- set the instant Send Receipt is tapped
  created_at timestamptz default now()
);

-- Audit trail for Admin edit/delete on chanda_entries, expense_entries, and
-- lucky_draw_entries — full before/after row snapshots (jsonb), kept forever,
-- written only by the backend (service role). Append-only: no update/delete
-- policies on this table at all.
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  entry_type text not null check (entry_type in ('chanda', 'expense', 'lucky_draw')),
  entry_id uuid not null, -- no FK: the row may no longer exist after a delete
  action text not null check (action in ('update', 'delete')),
  changed_by uuid references auth.users(id) not null,
  changed_at timestamptz default now(),
  old_values jsonb not null,
  new_values jsonb
);

create index audit_log_org_id_idx on audit_log(org_id);
create index audit_log_entry_idx on audit_log(entry_type, entry_id);

-- ============================================================================
-- Helper functions (security definer — avoids RLS self-recursion on org_members)
-- ============================================================================

create function is_org_member(target_org uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from org_members
    where org_id = target_org
      and user_id = auth.uid()
      and status = 'joined'
  );
$$;

create function has_full_access(target_org uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from org_members
    where org_id = target_org
      and user_id = auth.uid()
      and status = 'joined'
      and (access_level = 'full' or role = 'admin')
  );
$$;

create function is_org_admin(target_org uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from org_members
    where org_id = target_org
      and user_id = auth.uid()
      and status = 'joined'
      and role = 'admin'
  );
$$;

-- ============================================================================
-- Row-Level Security
-- ============================================================================

alter table organizations enable row level security;
alter table org_members enable row level security;
alter table chanda_entries enable row level security;
alter table chanda_comments enable row level security;
alter table expense_entries enable row level security;
alter table expense_comments enable row level security;
alter table announcements enable row level security;
alter table chanda_pledges enable row level security;
alter table lucky_draw_entries enable row level security;
alter table audit_log enable row level security;

-- organizations ---------------------------------------------------------

create policy "members can read their org"
  on organizations for select
  using (is_org_member(id));

create policy "authenticated users can create an org"
  on organizations for insert
  with check (created_by = auth.uid());

create policy "admin can update org (logo, name, lucky draw settings)"
  on organizations for update
  using (is_org_admin(id));

-- org_members ------------------------------------------------------------
-- Insert is split into two narrow policies rather than one permissive rule:
-- a naive "admin OR added_by = self" check would let any member insert
-- arbitrary rows by setting added_by to themselves.

create policy "members can read their org's member list"
  on org_members for select
  using (is_org_member(org_id));

create policy "creator can self-insert as admin"
  on org_members for insert
  with check (
    role = 'admin'
    and user_id = auth.uid()
    and status = 'joined'
    and exists (
      select 1 from organizations o
      where o.id = org_id and o.created_by = auth.uid()
    )
  );

create policy "admin can add pending members"
  on org_members for insert
  with check (is_org_admin(org_id));

create policy "admin can update members"
  on org_members for update
  using (is_org_admin(org_id));

create policy "admin can remove members"
  on org_members for delete
  using (is_org_admin(org_id));

-- chanda_pledges -----------------------------------------------------------
-- Mutable by design (pending -> resolved) — this is a to-do list, not the
-- financial record. See table comment above.

create policy "members can read pledges"
  on chanda_pledges for select
  using (is_org_member(org_id));

create policy "full access members can create pledges"
  on chanda_pledges for insert
  with check (has_full_access(org_id) and created_by = auth.uid());

create policy "full access members can resolve pledges"
  on chanda_pledges for update
  using (has_full_access(org_id));

-- chanda_entries -----------------------------------------------------------
-- Immutable for everyone except Admin, who can edit/delete (no audit trail
-- kept — a deliberate reversal of the original "no update/delete, ever"
-- rule, scoped to Admin only). Full Access can still only insert/read.

create policy "members can read chanda entries"
  on chanda_entries for select
  using (is_org_member(org_id));

create policy "full access members can add chanda entries"
  on chanda_entries for insert
  with check (has_full_access(org_id) and collected_by = auth.uid());

create policy "admin can update chanda entries"
  on chanda_entries for update
  using (is_org_admin(org_id));

create policy "admin can delete chanda entries"
  on chanda_entries for delete
  using (is_org_admin(org_id));

-- chanda_comments ----------------------------------------------------------

create policy "members can read chanda comments"
  on chanda_comments for select
  using (
    is_org_member((select org_id from chanda_entries where id = chanda_entry_id))
  );

create policy "full access members can comment on chanda entries"
  on chanda_comments for insert
  with check (
    has_full_access((select org_id from chanda_entries where id = chanda_entry_id))
    and commented_by = auth.uid()
  );

-- expense_entries ------------------------------------------------------
-- Same immutable-except-Admin rule as chanda_entries.

create policy "members can read expense entries"
  on expense_entries for select
  using (is_org_member(org_id));

create policy "full access members can add expense entries"
  on expense_entries for insert
  with check (has_full_access(org_id) and logged_by = auth.uid());

create policy "admin can update expense entries"
  on expense_entries for update
  using (is_org_admin(org_id));

create policy "admin can delete expense entries"
  on expense_entries for delete
  using (is_org_admin(org_id));

-- expense_comments -----------------------------------------------------

create policy "members can read expense comments"
  on expense_comments for select
  using (
    is_org_member((select org_id from expense_entries where id = expense_entry_id))
  );

create policy "full access members can comment on expense entries"
  on expense_comments for insert
  with check (
    has_full_access((select org_id from expense_entries where id = expense_entry_id))
    and commented_by = auth.uid()
  );

-- announcements ----------------------------------------------------------
-- Any full-access member may create, edit, or delete any announcement in
-- their org (open trust-based model per PRD 5.5).

create policy "members can read announcements"
  on announcements for select
  using (is_org_member(org_id));

create policy "full access members can post announcements"
  on announcements for insert
  with check (has_full_access(org_id) and posted_by = auth.uid());

create policy "full access members can edit any announcement"
  on announcements for update
  using (has_full_access(org_id));

create policy "full access members can delete any announcement"
  on announcements for delete
  using (has_full_access(org_id));

-- lucky_draw_entries ---------------------------------------------------
-- Same immutable-except-Admin rule as chanda/expense entries.

create policy "members can read lucky draw entries"
  on lucky_draw_entries for select
  using (is_org_member(org_id));

create policy "full access members can add lucky draw entries"
  on lucky_draw_entries for insert
  with check (has_full_access(org_id) and sold_by = auth.uid());

create policy "admin can update lucky draw entries"
  on lucky_draw_entries for update
  using (is_org_admin(org_id));

create policy "admin can delete lucky draw entries"
  on lucky_draw_entries for delete
  using (is_org_admin(org_id));

-- audit_log --------------------------------------------------------------
-- Append-only: no insert/update/delete policy for clients at all. Only the
-- backend's service-role client writes here (bypasses RLS).

create policy "admin can read audit log"
  on audit_log for select
  using (is_org_admin(org_id));

-- ============================================================================
-- Storage buckets — all public (writes only ever go through the FastAPI
-- backend via service role after an admin/full-access check in Python;
-- public=true means reads work with no select policy needed).
-- ============================================================================

insert into storage.buckets (id, name, public)
values
  ('org-logos', 'org-logos', true),
  ('expense-receipts', 'expense-receipts', true),
  ('announcement-images', 'announcement-images', true),
  ('lucky-draw-qr', 'lucky-draw-qr', true)
on conflict (id) do nothing;
