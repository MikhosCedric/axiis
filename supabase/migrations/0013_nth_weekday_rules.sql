-- Monthly rules on a weekday by its place in the month: BYDAY=2TU (the second
-- Tuesday), BYDAY=-1FR (the last Friday). First to fourth and last only, one
-- weekday, monthly rules only. Everything 0004 allowed is still allowed, so
-- no stored row can fail the new check.
-- Contract: docs/recurrence.md.

alter table public.items
  drop constraint items_rrule_allowlist,
  add constraint items_rrule_allowlist check (
    rrule is null
    or rrule ~ '^FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)(;INTERVAL=[1-9][0-9]?)?(;BYDAY=(MO|TU|WE|TH|FR|SA|SU)(,(MO|TU|WE|TH|FR|SA|SU)){0,6})?(;UNTIL=[0-9]{8}|;COUNT=[1-9][0-9]{0,3})?$'
    or rrule ~ '^FREQ=MONTHLY(;INTERVAL=[1-9][0-9]?)?;BYDAY=(-1|[1-4])(MO|TU|WE|TH|FR|SA|SU)(;UNTIL=[0-9]{8}|;COUNT=[1-9][0-9]{0,3})?$'
  );
