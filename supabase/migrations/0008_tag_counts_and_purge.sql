-- Tag use counts in one query, and a purge of old soft-deleted items.

-- Each tag's open, live items, for the caller. The detail panel orders its tag
-- suggestions by this and the Tags page shows it. The app used to page every
-- open item_tags row through PostgREST and count in JavaScript; this answers in
-- one request with at most one row per tag (500 by 0006).
--
-- SECURITY INVOKER: Row Level Security limits both tables to the caller's rows.
-- The user_id filters are there so the planner can use item_tags_user_tag and
-- the items primary key; item_tags is bounded at 20 per item by 0006.
create function public.tag_open_counts()
returns table (tag_id uuid, open integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select t.tag_id, count(*)::integer
  from public.item_tags t
  join public.items i on i.id = t.item_id
  where t.user_id = (select auth.uid())
    and i.user_id = (select auth.uid())
    and i.status = 'open'
    and i.deleted_at is null
  group by t.tag_id
$$;

revoke execute on function public.tag_open_counts() from public, anon;
grant execute on function public.tag_open_counts() to authenticated;

-- Purge. 0006 counts soft-deleted items toward the 20000 cap (leaving them out
-- would let an insert-then-delete loop grow an account forever), so an account
-- at its cap could never free room. This hard-deletes the caller's items
-- soft-deleted more than 30 days ago: deleting frees room 30 days later, and
-- a loop still holds at most the cap within any 30 days. The app calls it after
-- each delete; a failure there never fails the delete.
--
-- At most 500 rows a call, oldest first, so one call's cost is bounded.
-- Links and item_tags go with their item by cascade. Two foreign keys need care:
--   parent_id has no action, so a parent stays while any child is not purged
--     with it (children are soft-deleted with their parent, so this is rare);
--   series_id cascades, and a deleted series leaves its overrides as ordinary
--     items, so those that stay are detached (series_id, original_on = null)
--     first, as "Does not repeat" detaches them, rather than deleted with it.
--
-- SECURITY INVOKER: Row Level Security limits every statement to the caller's
-- rows; the user_id filters let the planner use the indexes.
create index items_user_deleted_at on public.items (user_id, deleted_at) where deleted_at is not null;

create function public.purge_deleted_items()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  candidates uuid[];
  doomed uuid[];
  purged integer;
begin
  select coalesce(array_agg(id), '{}') into candidates
  from (
    select id from public.items
    where user_id = me and deleted_at < now() - interval '30 days'
    order by deleted_at
    limit 500
  ) c;

  select coalesce(array_agg(p.id), '{}') into doomed
  from unnest(candidates) as p(id)
  where not exists (
    select 1 from public.items child
    where child.user_id = me and child.parent_id = p.id and child.id <> all (candidates)
  );

  update public.items set series_id = null, original_on = null
  where user_id = me and series_id = any (doomed) and id <> all (doomed);

  delete from public.items where user_id = me and id = any (doomed);
  get diagnostics purged = row_count;
  return purged;
end;
$$;

revoke execute on function public.purge_deleted_items() from public, anon;
grant execute on function public.purge_deleted_items() to authenticated;
