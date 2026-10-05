-- Core schema: areas, items, links, tags, item_tags. Contract: docs/data-model.md.

create type public.item_type as enum ('task', 'event', 'note', 'checklist');
create type public.item_status as enum ('open', 'done', 'dropped');
create type public.link_kind as enum ('reference');

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- areas

create table public.areas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, id)
);

-- items

create table public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type public.item_type not null,
  title text not null default '',
  body jsonb,
  status public.item_status not null default 'open',
  area_id uuid,
  parent_id uuid,
  position double precision not null default 0,
  start_at timestamptz,
  end_at timestamptz,
  scheduled_on date,
  due_on date,
  rrule text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, id),
  foreign key (user_id, area_id) references public.areas (user_id, id) on delete no action,
  foreign key (user_id, parent_id) references public.items (user_id, id),
  constraint items_plan_exclusive check (not (start_at is not null and scheduled_on is not null)),
  constraint items_timed_pair check ((start_at is null) = (end_at is null)),
  constraint items_timed_order check (end_at > start_at),
  constraint items_not_own_parent check (parent_id <> id),
  constraint items_note_unscheduled check (
    type <> 'note'
    or (start_at is null and end_at is null and scheduled_on is null and due_on is null)
  )
);

create index items_user_start_at on public.items (user_id, start_at) where deleted_at is null;
create index items_user_scheduled_on on public.items (user_id, scheduled_on) where deleted_at is null;
create index items_user_parent on public.items (user_id, parent_id) where deleted_at is null;
create index items_user_area on public.items (user_id, area_id) where deleted_at is null;
create index items_user_status on public.items (user_id, status) where deleted_at is null;

-- Enforces both directions of the hierarchy rule, so neither reparenting a
-- parent nor retyping a parent can produce a third level or a note/event parent.
create function public.items_check_hierarchy()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent public.items%rowtype;
begin
  if new.parent_id is not null then
    if new.type in ('note', 'event') then
      raise exception 'a % cannot have a parent', new.type using errcode = 'check_violation';
    end if;

    select * into parent from public.items where user_id = new.user_id and id = new.parent_id;
    -- A missing parent is left to the composite foreign key to reject.
    if found then
      if parent.type not in ('task', 'checklist') then
        raise exception 'a % cannot be a parent', parent.type using errcode = 'check_violation';
      end if;
      if parent.parent_id is not null then
        raise exception 'subtasks nest at most two levels' using errcode = 'check_violation';
      end if;
    end if;

    if exists (select 1 from public.items where user_id = new.user_id and parent_id = new.id) then
      raise exception 'subtasks nest at most two levels' using errcode = 'check_violation';
    end if;
  end if;

  if new.type not in ('task', 'checklist')
    and exists (select 1 from public.items where user_id = new.user_id and parent_id = new.id) then
    raise exception 'a % cannot be a parent', new.type using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger items_check_hierarchy
  before insert or update of parent_id, type on public.items
  for each row execute function public.items_check_hierarchy();

-- links

create table public.links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  from_id uuid not null,
  to_id uuid not null,
  kind public.link_kind not null default 'reference',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (user_id, from_id) references public.items (user_id, id) on delete cascade,
  foreign key (user_id, to_id) references public.items (user_id, id) on delete cascade,
  unique (from_id, to_id, kind),
  constraint links_not_self check (from_id <> to_id)
);

-- tags, item_tags

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id)
);

create unique index tags_user_name_ci on public.tags (user_id, lower(name));

create table public.item_tags (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id uuid not null,
  tag_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (item_id, tag_id),
  foreign key (user_id, item_id) references public.items (user_id, id) on delete cascade,
  foreign key (user_id, tag_id) references public.tags (user_id, id) on delete cascade
);

-- updated_at triggers

create trigger areas_set_updated_at before update on public.areas
  for each row execute function public.set_updated_at();
create trigger items_set_updated_at before update on public.items
  for each row execute function public.set_updated_at();
create trigger links_set_updated_at before update on public.links
  for each row execute function public.set_updated_at();
create trigger tags_set_updated_at before update on public.tags
  for each row execute function public.set_updated_at();
create trigger item_tags_set_updated_at before update on public.item_tags
  for each row execute function public.set_updated_at();

-- Row level security: owner-only for authenticated, nothing for anon.

alter table public.areas enable row level security;
alter table public.items enable row level security;
alter table public.links enable row level security;
alter table public.tags enable row level security;
alter table public.item_tags enable row level security;

create policy areas_select on public.areas for select to authenticated using (user_id = (select auth.uid()));
create policy areas_insert on public.areas for insert to authenticated with check (user_id = (select auth.uid()));
create policy areas_update on public.areas for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy areas_delete on public.areas for delete to authenticated using (user_id = (select auth.uid()));

create policy items_select on public.items for select to authenticated using (user_id = (select auth.uid()));
create policy items_insert on public.items for insert to authenticated with check (user_id = (select auth.uid()));
create policy items_update on public.items for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy items_delete on public.items for delete to authenticated using (user_id = (select auth.uid()));

create policy links_select on public.links for select to authenticated using (user_id = (select auth.uid()));
create policy links_insert on public.links for insert to authenticated with check (user_id = (select auth.uid()));
create policy links_update on public.links for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy links_delete on public.links for delete to authenticated using (user_id = (select auth.uid()));

create policy tags_select on public.tags for select to authenticated using (user_id = (select auth.uid()));
create policy tags_insert on public.tags for insert to authenticated with check (user_id = (select auth.uid()));
create policy tags_update on public.tags for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy tags_delete on public.tags for delete to authenticated using (user_id = (select auth.uid()));

create policy item_tags_select on public.item_tags for select to authenticated using (user_id = (select auth.uid()));
create policy item_tags_insert on public.item_tags for insert to authenticated with check (user_id = (select auth.uid()));
create policy item_tags_update on public.item_tags for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy item_tags_delete on public.item_tags for delete to authenticated using (user_id = (select auth.uid()));

-- Supabase's default privileges grant every new table to anon; take that back.
revoke all on public.areas, public.items, public.links, public.tags, public.item_tags from anon, authenticated;
grant select, insert, update, delete on public.areas, public.items, public.links, public.tags, public.item_tags to authenticated;

-- New users: seed default areas.

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.areas (user_id, name, position)
  values (new.id, 'Work', 1), (new.id, 'Home', 2), (new.id, 'Health', 3);
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
