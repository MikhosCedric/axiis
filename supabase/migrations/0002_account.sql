-- Account deletion: a signed-in user removes their own auth.users row, and every
-- public table cascades from it (user_id ... references auth.users on delete cascade).

create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'delete_my_account needs a signed-in user' using errcode = 'insufficient_privilege';
  end if;
  delete from auth.users where id = me;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
