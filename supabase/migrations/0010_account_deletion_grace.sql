-- Account deletion with a 14-day undo. Settings inserts the caller's row here; the account keeps
-- working, and every page shows when it goes and an Undo that deletes the row. The purge, scheduled
-- by the owner (docs/launch-checklist.md, Account deletion purge), removes accounts whose row is
-- 14 days old through the same cascade as delete_my_account, which stays for "Delete now".

create table public.account_deletions (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  requested_at timestamptz not null default now()
);

alter table public.account_deletions enable row level security;

create policy account_deletions_select on public.account_deletions
  for select to authenticated using (user_id = (select auth.uid()));
create policy account_deletions_insert on public.account_deletions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy account_deletions_delete on public.account_deletions
  for delete to authenticated using (user_id = (select auth.uid()));

-- No update: a request is made or withdrawn, never moved.
revoke all on public.account_deletions from anon, authenticated;
grant select, insert, delete on public.account_deletions to authenticated;

-- The database's clock, so a client cannot backdate its request into the purge window.
create function public.stamp_deletion_request()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.requested_at := now();
  return new;
end;
$$;

revoke execute on function public.stamp_deletion_request() from public, anon, authenticated;

create trigger account_deletions_stamp before insert on public.account_deletions
  for each row execute function public.stamp_deletion_request();

-- Deletes up to 50 accounts whose request is at least 14 days old, oldest first, and returns how many.
-- The cap keeps one run short: an account at its quotas cascades through about 20,000 items.
create function public.purge_due_accounts()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  purged integer;
begin
  with due as (
    select user_id from public.account_deletions
    where requested_at <= now() - interval '14 days'
    order by requested_at
    limit 50
  )
  delete from auth.users u using due where u.id = due.user_id;
  get diagnostics purged = row_count;
  return purged;
end;
$$;

-- Only the owner's schedule runs it: pg_cron as postgres, or the service role. Supabase's default
-- privileges grant new functions to anon and authenticated, so both are revoked by name.
revoke execute on function public.purge_due_accounts() from public, anon, authenticated;
grant execute on function public.purge_due_accounts() to service_role;
