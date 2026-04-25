create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, ''), '@', 1))
  )
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(public.profiles.display_name, excluded.display_name);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.join_household_by_invite(
  invite_code_input text,
  display_name_input text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_household_id uuid;
  empty_member_key text;
begin
  if auth.uid() is null then
    raise exception 'Please sign in first';
  end if;

  select id into target_household_id
  from public.households
  where invite_code = upper(trim(invite_code_input));

  if target_household_id is null then
    raise exception 'Invite code not found';
  end if;

  if exists (
    select 1
    from public.household_members
    where household_id = target_household_id
      and user_id = auth.uid()
  ) then
    return target_household_id;
  end if;

  select member_key into empty_member_key
  from public.household_members
  where household_id = target_household_id
    and user_id is null
  order by member_key
  limit 1;

  if empty_member_key is null then
    raise exception 'This household is already full';
  end if;

  update public.household_members
  set user_id = auth.uid(),
      display_name = coalesce(nullif(trim(display_name_input), ''), display_name),
      joined_at = now()
  where household_id = target_household_id
    and member_key = empty_member_key
    and user_id is null;

  return target_household_id;
end;
$$;

drop policy if exists "members can update their own member row" on public.household_members;
create policy "members can update their own member row" on public.household_members
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());
