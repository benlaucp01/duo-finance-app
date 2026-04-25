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
