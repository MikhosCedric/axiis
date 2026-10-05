-- Full-text search over every item's title and the plain text of its body.
-- The app writes body_text alongside body (Tiptap JSON) on each save.

alter table public.items
  add column body_text text,
  -- to_tsvector refuses input past 1 MB; notes are capped well under that.
  add constraint items_body_text_size check (octet_length(body_text) <= 262144);

-- A short stored prefix so note lists can show a first line without reading whole bodies.
alter table public.items
  add column excerpt text generated always as (left(body_text, 280)) stored;

alter table public.items
  add column search tsvector generated always as (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(body_text, ''))
  ) stored;

create index items_search on public.items using gin (search);
