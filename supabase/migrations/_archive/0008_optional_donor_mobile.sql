-- Some donors decline to share a mobile number. Chanda entries no longer
-- require it — WhatsApp thank-you just isn't offered when it's missing.
alter table chanda_entries alter column donor_mobile drop not null;
