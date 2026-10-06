-- Recurrence: a series is an item with an rrule; an override is an item that
-- replaces one occurrence of a series. Occurrences themselves are not stored.
-- Contract: docs/recurrence.md.

alter table public.items
  add column series_id uuid,
  add column original_on date,
  add foreign key (user_id, series_id) references public.items (user_id, id) on delete cascade,
  add constraint items_series_pair check ((series_id is null) = (original_on is null)),
  add constraint items_not_own_series check (series_id <> id),
  add constraint items_override_not_recurring check (series_id is null or rrule is null),
  add constraint items_note_not_recurring check (type <> 'note' or rrule is null),
  add constraint items_recurring_scheduled check (rrule is null or start_at is not null or scheduled_on is not null),
  add constraint items_recurring_top_level check (rrule is null or parent_id is null),
  -- The canonical form the app writes. The app parses it again on read.
  add constraint items_rrule_allowlist check (
    rrule is null
    or rrule ~ '^FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)(;INTERVAL=[1-9][0-9]?)?(;BYDAY=(MO|TU|WE|TH|FR|SA|SU)(,(MO|TU|WE|TH|FR|SA|SU)){0,6})?(;UNTIL=[0-9]{8}|;COUNT=[1-9][0-9]{0,3})?$'
  );

create unique index items_series_original on public.items (series_id, original_on) where deleted_at is null;
create index items_user_series_masters on public.items (user_id) where rrule is not null and deleted_at is null;
create index items_user_original_on on public.items (user_id, original_on) where series_id is not null;

-- A recurring item has no subtasks and is never a subtask, and an override
-- points at a live-shaped series. Checked from every side, so neither
-- reparenting, retyping nor clearing a rule can break it later.
create function public.items_check_recurrence()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  series public.items%rowtype;
  parent public.items%rowtype;
begin
  if new.series_id is not null then
    if new.type = 'note' then
      raise exception 'a note cannot replace an occurrence' using errcode = 'check_violation';
    end if;
    if new.parent_id is not null then
      raise exception 'an occurrence cannot be a subtask' using errcode = 'check_violation';
    end if;
    select * into series from public.items where user_id = new.user_id and id = new.series_id;
    -- A missing series is left to the composite foreign key to reject.
    if found then
      if series.rrule is null then
        raise exception 'an occurrence must belong to a repeating item' using errcode = 'check_violation';
      end if;
      if series.parent_id is not null or series.type not in ('task', 'event', 'checklist') then
        raise exception 'a % cannot repeat', series.type using errcode = 'check_violation';
      end if;
    end if;
  end if;

  if (new.rrule is not null or new.series_id is not null)
    and exists (select 1 from public.items where user_id = new.user_id and parent_id = new.id) then
    raise exception 'a repeating item cannot have subtasks' using errcode = 'check_violation';
  end if;

  if new.parent_id is not null then
    select * into parent from public.items where user_id = new.user_id and id = new.parent_id;
    if found and (parent.rrule is not null or parent.series_id is not null) then
      raise exception 'a repeating item cannot have subtasks' using errcode = 'check_violation';
    end if;
  end if;

  if tg_op = 'UPDATE' and old.rrule is not null and new.rrule is null
    and exists (
      select 1 from public.items
      where user_id = new.user_id and series_id = new.id and deleted_at is null
    ) then
    raise exception 'detach the occurrences before a series stops repeating' using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger items_check_recurrence
  before insert or update of series_id, original_on, rrule, parent_id, type on public.items
  for each row execute function public.items_check_recurrence();
