-- Switch org_members login identity from phone to email — Twilio SMS OTP
-- proved impractical for this project (trial-account template + verified
-- caller ID restrictions), Supabase's built-in email OTP needs no external
-- provider. mobile_number is dropped from the login/matching path entirely;
-- kept nullable in case it's wanted later as free-text contact info.

alter table org_members
  add column email text,
  alter column mobile_number drop not null;

-- Backfill is not needed — no real membership rows exist yet (Phase 1 was
-- never reachable end-to-end due to the Twilio blocker).

alter table org_members
  alter column email set not null;

alter table org_members
  drop constraint org_members_org_id_mobile_number_key,
  add constraint org_members_org_id_email_key unique (org_id, email);
