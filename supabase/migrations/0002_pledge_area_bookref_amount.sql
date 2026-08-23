-- "Promised for later" was missing area/book-reference/amount fields that
-- "Received now" has, so switching the toggle hid data-entry fields instead
-- of just changing behavior. Add them to chanda_pledges so the same fields
-- are captured either way; area/book_reference carry into the chanda_entries
-- row once a pledge resolves (see routers/pledges.py). promised_amount is
-- informational only — resolving still asks for the actual value/amount.

alter table chanda_pledges
  add column area text,
  add column book_reference text,
  add column promised_amount numeric(10,2);
