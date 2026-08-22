-- In-kind chanda pledges (rice, oil, groceries promised but not yet collected).
-- Unlike chanda_entries, this table is deliberately NOT immutable — a pledge
-- is a to-do/reminder, not a financial record. It becomes part of the
-- permanent, immutable ledger only when resolved: resolving inserts a new
-- chanda_entries row (additive, consistent with the rest of the app) and
-- marks the pledge done. Nothing in chanda_entries is ever edited.

create table chanda_pledges (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  donor_name text not null,
  donor_mobile text not null,
  item_description text not null,
  promised_on date not null default current_date,
  status text not null default 'pending' check (status in ('pending', 'resolved')),
  resolved_chanda_entry_id uuid, -- FK added below, after chanda_entries gets its new columns
  created_by uuid references auth.users(id) not null,
  created_at timestamptz default now()
);

alter table chanda_entries
  add column item_description text,   -- null = cash entry; set = in-kind (resolved pledge)
  add column pledge_id uuid references chanda_pledges(id);

alter table chanda_pledges
  add constraint chanda_pledges_resolved_entry_fkey
  foreign key (resolved_chanda_entry_id) references chanda_entries(id);

-- amount was NOT NULL with an implicit "always a real cash figure" assumption;
-- in-kind entries with no estimated value use 0, which is a valid amount, so
-- the column constraint itself doesn't need to change.

alter table chanda_pledges enable row level security;

create policy "members can read pledges"
  on chanda_pledges for select
  using (is_org_member(org_id));

create policy "full access members can create pledges"
  on chanda_pledges for insert
  with check (has_full_access(org_id) and created_by = auth.uid());

create policy "full access members can resolve pledges"
  on chanda_pledges for update
  using (has_full_access(org_id));
