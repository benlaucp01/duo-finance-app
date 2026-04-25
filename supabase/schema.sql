create extension if not exists "pgcrypto";

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now()
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  base_currency text not null default 'HKD' check (base_currency = 'HKD'),
  invite_code text not null unique,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  member_key text not null check (member_key in ('personA', 'personB')),
  display_name text not null,
  joined_at timestamptz not null default now(),
  primary key (household_id, member_key),
  unique (household_id, user_id)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  color text not null,
  created_at timestamptz not null default now()
);

create table public.exchange_rates (
  rate_date date not null,
  currency text not null,
  base_currency text not null default 'HKD',
  rate_to_hkd numeric(18, 8) not null,
  source text not null check (source in ('auto', 'manual', 'fallback')),
  created_at timestamptz not null default now(),
  primary key (rate_date, currency, base_currency)
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  expense_date date not null,
  title text not null,
  original_amount numeric(12, 2) not null check (original_amount > 0),
  original_currency text not null,
  exchange_rate_to_hkd numeric(18, 8) not null,
  hkd_amount numeric(12, 2) not null,
  payer_key text not null check (payer_key in ('personA', 'personB')),
  category_id uuid references public.categories(id) on delete set null,
  split_mode text not null check (split_mode in ('equal', 'personA', 'personB', 'custom')),
  note text not null default '',
  rate_source text not null check (rate_source in ('hkd', 'auto', 'manual', 'fallback')),
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.expense_splits (
  expense_id uuid not null references public.expenses(id) on delete cascade,
  member_key text not null check (member_key in ('personA', 'personB')),
  hkd_amount numeric(12, 2) not null check (hkd_amount >= 0),
  primary key (expense_id, member_key)
);

create table public.settlement_snapshots (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  settlement_month text not null,
  total_hkd numeric(12, 2) not null,
  person_a_paid numeric(12, 2) not null,
  person_b_paid numeric(12, 2) not null,
  person_a_owed numeric(12, 2) not null,
  person_b_owed numeric(12, 2) not null,
  transfer_from text check (transfer_from in ('personA', 'personB')),
  transfer_to text check (transfer_to in ('personA', 'personB')),
  transfer_amount numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  unique (household_id, settlement_month)
);

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.categories enable row level security;
alter table public.exchange_rates enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_splits enable row level security;
alter table public.settlement_snapshots enable row level security;

create or replace function public.is_household_member(target_household_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.household_members
    where household_id = target_household_id
      and user_id = auth.uid()
  );
$$;

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

create policy "profiles are self readable" on public.profiles
  for select using (id = auth.uid());

create policy "profiles are self writable" on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

create policy "members can read households" on public.households
  for select using (public.is_household_member(id));

create policy "authenticated users can create households" on public.households
  for insert with check (created_by = auth.uid());

create policy "members can update households" on public.households
  for update using (public.is_household_member(id));

create policy "members can read household members" on public.household_members
  for select using (public.is_household_member(household_id));

create policy "creators can add household members" on public.household_members
  for insert with check (
    exists (
      select 1 from public.households
      where id = household_id and created_by = auth.uid()
    )
  );

create policy "members can update their own member row" on public.household_members
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "members can manage categories" on public.categories
  for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "members can manage expenses" on public.expenses
  for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "members can manage splits" on public.expense_splits
  for all using (
    exists (
      select 1 from public.expenses
      where expenses.id = expense_id
        and public.is_household_member(expenses.household_id)
    )
  )
  with check (
    exists (
      select 1 from public.expenses
      where expenses.id = expense_id
        and public.is_household_member(expenses.household_id)
    )
  );

create policy "members can manage snapshots" on public.settlement_snapshots
  for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "authenticated users can read exchange rates" on public.exchange_rates
  for select using (auth.role() = 'authenticated');

create policy "authenticated users can cache exchange rates" on public.exchange_rates
  for insert with check (auth.role() = 'authenticated');
