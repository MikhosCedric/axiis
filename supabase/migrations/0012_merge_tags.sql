-- Merge one tag into another in one statement, whatever the number of items.
--
-- The app could only read a tag's items through PostgREST, which caps a read, so
-- a merge done in JavaScript could stop short and leave items without the tag
-- they were meant to keep. This does the whole move in the database.
--
-- Every item that wears `source` comes to wear `target` instead, and `source` is
-- deleted. An item that already wears both keeps one `target` row. Rows are moved
-- with UPDATE, not inserted, so no item ever holds more tags than before and the
-- 0006 per-item quota (an insert trigger) cannot refuse the merge. The row that
-- would duplicate a `target` row is left on `source` and goes with it by cascade.
--
-- Returns how many items wore `source`: each of them changes.
--
-- SECURITY INVOKER: Row Level Security limits every read and write to the
-- caller's rows, and the explicit user_id filters let the planner use
-- item_tags_user_tag. A tag of another user is simply not found.
create function public.merge_tags(source uuid, target uuid)
returns integer
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  changed integer;
begin
  if source = target then
    raise exception 'a tag cannot be merged into itself' using errcode = 'invalid_parameter_value';
  end if;
  -- Lock both tags, in id order so two merges cannot deadlock, and prove both are the caller's.
  perform 1 from public.tags where user_id = me and id in (source, target) order by id for update;
  if (select count(*) from public.tags where user_id = me and id in (source, target)) <> 2 then
    raise exception 'tag not found' using errcode = 'no_data_found';
  end if;

  select count(*)::integer into changed from public.item_tags where user_id = me and tag_id = source;

  update public.item_tags s
  set tag_id = target
  where s.user_id = me
    and s.tag_id = source
    and not exists (
      select 1 from public.item_tags t where t.user_id = me and t.item_id = s.item_id and t.tag_id = target
    );

  delete from public.tags where user_id = me and id = source;
  return changed;
end;
$$;

revoke execute on function public.merge_tags(uuid, uuid) from public, anon;
grant execute on function public.merge_tags(uuid, uuid) to authenticated;
