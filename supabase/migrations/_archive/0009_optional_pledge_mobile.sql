-- Missed in 0008 — chanda_pledges.donor_mobile has the same "some donors
-- decline to share a number" requirement as chanda_entries.
alter table chanda_pledges alter column donor_mobile drop not null;

-- A pledge can now represent plain cash promised for later (no item involved),
-- not just in-kind items — item_description is no longer mandatory.
alter table chanda_pledges alter column item_description drop not null;
