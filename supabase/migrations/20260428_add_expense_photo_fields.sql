alter table public.expenses
add column if not exists photo_data_url text,
add column if not exists photo_caption text not null default '',
add column if not exists notify_other boolean not null default false;
