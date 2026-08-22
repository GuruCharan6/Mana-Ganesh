-- Public bucket for org logos. Writes only ever go through the FastAPI
-- backend (service role, bypasses storage RLS) after an admin check, so no
-- insert/update/delete storage policies are needed. public=true makes
-- reads work without a select policy.

insert into storage.buckets (id, name, public)
values ('org-logos', 'org-logos', true)
on conflict (id) do nothing;
