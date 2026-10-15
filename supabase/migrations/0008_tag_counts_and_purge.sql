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
