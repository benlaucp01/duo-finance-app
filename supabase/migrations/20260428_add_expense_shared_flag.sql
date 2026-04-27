alter table public.expenses
add column if not exists is_shared boolean not null default true;
