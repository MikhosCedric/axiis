-- Rate limits: 0006 caps how many rows an account holds, not how fast it adds
-- them. A script with a session can write to PostgREST directly, past every
-- server action, so the throttle lives here.
--
-- Rows an account may add in any 60 seconds, against what the app needs:
--   items  120  One per capture, subtask, note or moved occurrence. No app flow
--               inserts items in bulk.
--   links  120  One per link, or one note and one link from "new linked note".
--   tags    60  A capture adds at most TAGS_PER_ITEM (10) new tags at once.
--   areas   30  Signup seeds three; the app keeps at most 12 live.
-- item_tags is left out: 0006 caps it at 20 per item, and items are throttled.
--
-- The window is created_at, so created_at must be the database's clock: an
-- insert stamps now() whatever the client sent, and an update keeps the old
-- value. Without that a client could backdate rows (on insert, or with an
-- update after) and never fill the window. created_at is when the row was made,
-- so nothing in the app sets it.
--
-- Like 0006 this is an AFTER INSERT statement trigger over the inserted rows,
-- so a bulk insert is checked once, and its own rows count toward the window.
-- It counts at most limit + 1 rows through a (user_id, created_at) index.
-- Two concurrent inserts can each see room; the overshoot is bounded by the
-- number of concurrent transactions, as with the quotas.
--
-- The error is SQLSTATE 54R01, a code of our own in the program-limit class,
-- so the app can tell "slow down" from 0006's "account is full" (54000).
-- SECURITY INVOKER for the same reason as 0006: RLS shows a user their own rows.

create function public.pin_created_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.created_at := case when tg_op = 'INSERT' then now() else old.created_at end;
  return new;
end;
$$;

create function public.enforce_insert_rate()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  per_minute int := tg_argv[0]::int;
  over uuid;
begin
  execute format(
    'select n.user_id from (select distinct user_id from inserted) n
     where (select count(*) from (
       select 1 from public.%I t
       where t.user_id = n.user_id and t.created_at > now() - interval ''60 seconds''
       limit $1 + 1) c) > $1
     limit 1',
    tg_table_name
  ) into over using per_minute;
  if over is not null then
    raise exception 'rate limited: at most % % a minute per account', per_minute, tg_table_name
      using errcode = '54R01', detail = tg_table_name;
  end if;
  return null;
end;
$$;

revoke execute on function public.pin_created_at() from public, anon, authenticated;
revoke execute on function public.enforce_insert_rate() from public, anon, authenticated;

create index items_user_created on public.items (user_id, created_at);
create index links_user_created on public.links (user_id, created_at);
create index tags_user_created on public.tags (user_id, created_at);
create index areas_user_created on public.areas (user_id, created_at);

create trigger items_pin_created_at before insert or update on public.items
  for each row execute function public.pin_created_at();
create trigger links_pin_created_at before insert or update on public.links
  for each row execute function public.pin_created_at();
create trigger tags_pin_created_at before insert or update on public.tags
  for each row execute function public.pin_created_at();
create trigger areas_pin_created_at before insert or update on public.areas
  for each row execute function public.pin_created_at();

create trigger items_rate after insert on public.items
  referencing new table as inserted
  for each statement execute function public.enforce_insert_rate('120');
create trigger links_rate after insert on public.links
  referencing new table as inserted
  for each statement execute function public.enforce_insert_rate('120');
create trigger tags_rate after insert on public.tags
  referencing new table as inserted
  for each statement execute function public.enforce_insert_rate('60');
create trigger areas_rate after insert on public.areas
  referencing new table as inserted
  for each statement execute function public.enforce_insert_rate('30');
