-- Quotas: signup is open, so one account must not grow without bound by
-- writing to PostgREST directly. Each table gets a per-user row cap, and a
-- note body gets a tighter size cap.
--
-- Caps, with the app's own limit in brackets:
--   items      20000  [none]  Soft-deleted items count (see below). At 5 a day,
--                             subtasks and moved occurrences included, that is 11 years.
--   links      50000  [none]  Links join two items, so 2.5 per item on average.
--   tags         500  [200]   TAGS_PER_USER in src/domain/tag.ts. Tags are hard-deleted.
--   areas         50  [none]  Soft-deleted areas count. The rail shows a handful.
--   item_tags     20 per item [10]  TAGS_PER_ITEM. Bounds item_tags at 20 x the item cap.
--
-- Soft-deleted rows count. They keep their storage, and leaving them out would
-- let a loop of insert-then-soft-delete run forever. Nothing purges them yet,
-- so a purge of old soft-deleted rows is the remedy if a real account nears a cap.
--
-- The check is an AFTER INSERT statement trigger over the inserted rows, so a
-- bulk insert counts once per statement, not once per row (a row trigger made
-- a 20000-row insert quadratic). It counts at most cap + 1 rows through an
-- index that leads with the counted column, and never reads a body.
-- Two concurrent inserts can each see room and both land; the overshoot is
-- bounded by the number of concurrent transactions, which is fine for an abuse cap.
--
-- The error is SQLSTATE 54000 (program_limit_exceeded); the app maps it to a sentence.
-- SECURITY INVOKER is enough: Row Level Security shows a user all of their own rows,
-- and the definer functions that insert (handle_new_user) count as their owner.

create function public.enforce_user_quota()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  cap int := tg_argv[0]::int;
  over uuid;
begin
  execute format(
    'select n.user_id from (select distinct user_id from inserted) n
     where (select count(*) from (select 1 from public.%I t where t.user_id = n.user_id limit $1 + 1) c) > $1
     limit 1',
    tg_table_name
  ) into over using cap;
  if over is not null then
    raise exception 'quota exceeded: at most % % per account', cap, tg_table_name
      using errcode = 'program_limit_exceeded', detail = tg_table_name;
  end if;
  return null;
end;
$$;

create function public.enforce_item_tags_quota()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  cap int := tg_argv[0]::int;
begin
  if exists (
    select 1 from (select distinct item_id from inserted) n
    where (select count(*) from (select 1 from public.item_tags t where t.item_id = n.item_id limit cap + 1) c) > cap
  ) then
    raise exception 'quota exceeded: at most % tags per item', cap
      using errcode = 'program_limit_exceeded', detail = 'item_tags';
  end if;
  return null;
end;
$$;

revoke execute on function public.enforce_user_quota() from public, anon, authenticated;
revoke execute on function public.enforce_item_tags_quota() from public, anon, authenticated;

create trigger items_quota after insert on public.items
  referencing new table as inserted
  for each statement execute function public.enforce_user_quota('20000');
create trigger links_quota after insert on public.links
  referencing new table as inserted
  for each statement execute function public.enforce_user_quota('50000');
create trigger tags_quota after insert on public.tags
  referencing new table as inserted
  for each statement execute function public.enforce_user_quota('500');
create trigger areas_quota after insert on public.areas
  referencing new table as inserted
  for each statement execute function public.enforce_user_quota('50');
create trigger item_tags_quota after insert on public.item_tags
  referencing new table as inserted
  for each statement execute function public.enforce_item_tags_quota('20');

-- Account deletion cascades through every item, and each deleted item checks the
-- parent foreign key for children. items_user_parent is partial on deleted_at, so
-- that check could not use it and scanned the table per row. In PGlite, deleting
-- 1000, 2000 and 4000 items took 93, 270 and 829 ms (quadratic); with this index,
-- 74, 116 and 286 ms, and 20000 items 1.4 s.
create index items_user_parent_fk on public.items (user_id, parent_id) where parent_id is not null;

-- The note editor refuses a body over 200 KB of JSON (BODY_MAX_BYTES in
-- src/features/notes/doc.ts). As jsonb that measured at most 1.5 times larger
-- (a body of one-letter marked paragraphs), so 512 KB leaves room and is a
-- quarter of the old 2 MB. body_text is plain text drawn from that JSON, so
-- its 256 KB cap from 0003 already sits above anything the editor can save.
alter table public.items
  drop constraint items_body_size,
  add constraint items_body_size check (body is null or pg_column_size(body) <= 524288);
