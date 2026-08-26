-- Audit trail for Admin edit/delete on chanda_entries, expense_entries, and
-- lucky_draw_entries. These three tables have no UPDATE/DELETE audit history
-- otherwise (see 0001_init.sql comments — Admin edit/delete was added as a
-- deliberate "no audit trail kept" decision; this migration reverses that).
--
-- Full before/after row snapshots (jsonb) rather than per-field diffs — keeps
-- the write path trivial (just json-dump the row you already fetched) and
-- means no future column can silently fall outside what gets captured.
--
-- Only the FastAPI backend (service-role key, bypasses RLS) ever writes here.
-- No update/delete policies at all — the trail itself is meant to be
-- append-only and permanent (kept forever, no retention/cleanup job).

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  entry_type text not null check (entry_type in ('chanda', 'expense', 'lucky_draw')),
  entry_id uuid not null, -- no FK: the row may no longer exist after a delete
  action text not null check (action in ('update', 'delete')),
  changed_by uuid references auth.users(id) not null,
  changed_at timestamptz default now(),
  old_values jsonb not null, -- full row snapshot before the change
  new_values jsonb -- full row snapshot after the change; null for delete
);

create index audit_log_org_id_idx on audit_log(org_id);
create index audit_log_entry_idx on audit_log(entry_type, entry_id);

alter table audit_log enable row level security;

create policy "admin can read audit log"
  on audit_log for select
  using (is_org_admin(org_id));
