-- Fix: the Phase 0 "admin can add members" INSERT policy on org_members had
-- `with check (is_org_admin(org_id) or added_by = auth.uid())`. The second
-- clause is always true for any authenticated user inserting their own
-- added_by value, so it let ANY member (including view-only) insert
-- arbitrary org_members rows. Replace with two narrow policies: one for the
-- org-creation bootstrap (self-insert as admin, only for an org you created,
-- only once since org_members has no re-insert path for an existing admin
-- row), and one for admin-added pending members.

drop policy "admin can add members" on org_members;

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

-- Also drop the phone-claim self-linking policy from Phase 0: it's superseded
-- by the FastAPI /auth/link-pending-member endpoint (service-role, which
-- normalizes phone number formatting before matching — the raw
-- auth.jwt()->>'phone' comparison here was fragile and unused by the app).

drop policy "user can claim their own pending invite" on org_members;
