-- Public bucket for expense receipt photos, same rationale as org-logos
-- (0003): writes only ever go through FastAPI (service role, admin/full-access
-- check enforced in Python), public=true means reads work with no select
-- policy. Paths are keyed by a random object id, not guessable.

insert into storage.buckets (id, name, public)
values ('expense-receipts', 'expense-receipts', true)
on conflict (id) do nothing;
