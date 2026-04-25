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

create or replace function public.create_household_with_defaults(
  person_a_name_input text,
  person_b_name_input text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_household_id uuid;
  new_invite_code text;
begin
  if auth.uid() is null then
    raise exception 'Please sign in first';
  end if;

  insert into public.profiles (id, email, display_name)
  select
    auth.users.id,
    coalesce(auth.users.email, ''),
    coalesce(nullif(trim(person_a_name_input), ''), split_part(coalesce(auth.users.email, ''), '@', 1), 'User')
  from auth.users
  where auth.users.id = auth.uid()
  on conflict (id) do update
    set email = excluded.email,
        display_name = excluded.display_name;

  loop
    new_invite_code := 'HKD-' || upper(substr(md5(random()::text), 1, 4));
    exit when not exists (
      select 1 from public.households where invite_code = new_invite_code
    );
  end loop;

  insert into public.households (name, invite_code, created_by)
  values ('我們的帳本', new_invite_code, auth.uid())
  returning id into new_household_id;

  insert into public.household_members (household_id, user_id, member_key, display_name)
  values
    (new_household_id, auth.uid(), 'personA', coalesce(nullif(trim(person_a_name_input), ''), 'Ben')),
    (new_household_id, null, 'personB', coalesce(nullif(trim(person_b_name_input), ''), 'Emily'));

  insert into public.categories (household_id, name, color)
  values
    (new_household_id, '餐飲', '#b7ff16'),
    (new_household_id, '交通', '#7fdc12'),
    (new_household_id, '租金', '#8fb8ff'),
    (new_household_id, '家居', '#64d6b5'),
    (new_household_id, '寵物', '#ffd6ff'),
    (new_household_id, '娛樂', '#bfa7ff'),
    (new_household_id, '購物', '#ffd166'),
    (new_household_id, '醫療', '#ff8fab'),
    (new_household_id, '其他', '#94a3b8');

  return new_household_id;
end;
$$;

drop policy if exists "members can update their own member row" on public.household_members;
create policy "members can update their own member row" on public.household_members
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());
