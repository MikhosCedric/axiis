-- Hardening: cover the foreign keys the advisor flagged, close the area-name race,
-- and bound the free-text columns so one account cannot store unbounded rows.
-- The limits match the app's own (TITLE_MAX, NOTE_TITLE_MAX, AREA_NAME_MAX, TAG_NAME_MAX).

-- Foreign keys without a covering index. A cascade delete, or a read of one series' overrides,
-- one item's tags or one item's links, would otherwise scan the whole table.
create index items_user_series on public.items (user_id, series_id) where series_id is not null;
create index item_tags_user_item on public.item_tags (user_id, item_id);
create index links_user_from on public.links (user_id, from_id);

-- The app refuses a second live area with the same name; this closes the race between two requests.
create unique index areas_user_name_live on public.areas (user_id, lower(name)) where deleted_at is null;

-- Text bounds. Lengths count characters; the body cap counts the stored jsonb bytes.
alter table public.items
  add constraint items_title_length check (char_length(title) <= 500),
  add constraint items_body_size check (body is null or pg_column_size(body) <= 2097152);
alter table public.areas add constraint areas_name_length check (char_length(name) between 1 and 40);
alter table public.tags add constraint tags_name_length check (char_length(name) between 1 and 32);
