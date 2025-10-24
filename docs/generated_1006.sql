-- Generated SQL to align DB with current app and dumps (__TABLES_1006, __RLS_1006, __helper_1006)
-- Safe to run multiple times (idempotent where possible)

-- 0) Extensions
create extension if not exists pgcrypto;

-- 1) Tables (create if not exists) and constraints
-- departments
create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  default_color text not null default '#64748b',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- profiles
create table if not exists public.profiles (
  id uuid primary key,
  display_name text not null,
  department_id uuid not null references public.departments(id),
  color_settings text not null default ''::text,
  is_admin boolean not null default false,
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- bookings
create table if not exists public.bookings (
  id bigint primary key,
  title text not null,
  description text not null default ''::text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure basic constraints on bookings
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'bookings_chk_time_order'
  ) then
    alter table public.bookings
      add constraint bookings_chk_time_order
      check (end_at > start_at);
  end if;
end $$;

-- 15-min granularity for start/end times (optional but recommended)
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'bookings_chk_15min'
  ) then
    alter table public.bookings
      add constraint bookings_chk_15min
      check (
        (extract(epoch from start_at)::int % (15*60) = 0) and
        (extract(epoch from end_at)::int % (15*60) = 0)
      );
  end if;
end $$;

-- Helpful indexes
create index if not exists bookings_start_at_idx on public.bookings (start_at);
create index if not exists bookings_created_by_idx on public.bookings (created_by);

-- 2) Public view for profiles (if missing)
create or replace view public.profiles_public as
  select p.id,
         p.display_name,
         p.department_id,
         d.name as department_name,
         p.color_settings
  from public.profiles p
  left join public.departments d on d.id = p.department_id;

-- 3) Helper functions (RLS helpers)
-- viewer_is_admin: SECURITY DEFINER, stable
create or replace function public.viewer_is_admin()
returns boolean
language sql stable
security definer
set search_path = public
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;
revoke all on function public.viewer_is_admin() from public;
grant execute on function public.viewer_is_admin() to anon, authenticated;

-- viewer_department: return profiles.department_id as uuid
create or replace function public.viewer_department()
returns uuid
language sql stable
security definer
set search_path = public
as $$
  select (select p.department_id from public.profiles p where p.id = auth.uid());
$$;
revoke all on function public.viewer_department() from public;
grant execute on function public.viewer_department() to anon, authenticated;

-- 4) Triggers
-- updated_at auto touch triggers
create or replace function public.tg_touch_updated_at()
returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end
$$;

do $$ begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_departments_touch_updated_at'
  ) then
    create trigger trg_departments_touch_updated_at
    before update on public.departments
    for each row execute function public.tg_touch_updated_at();
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_profiles_touch_updated_at'
  ) then
    create trigger trg_profiles_touch_updated_at
    before update on public.profiles
    for each row execute function public.tg_touch_updated_at();
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_bookings_touch_updated_at'
  ) then
    create trigger trg_bookings_touch_updated_at
    before update on public.bookings
    for each row execute function public.tg_touch_updated_at();
  end if;
end $$;

-- bookings.created_by default to auth.uid() if null
create or replace function public.tg_bookings_set_created_by()
returns trigger
language plpgsql as $$
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end
$$;

do $$ begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_bookings_set_created_by'
  ) then
    create trigger trg_bookings_set_created_by
    before insert on public.bookings
    for each row execute function public.tg_bookings_set_created_by();
  end if;
end $$;

-- 5) RLS enable + policies (as per __RLS_1006.json)
alter table public.bookings enable row level security;
alter table public.profiles enable row level security;

-- Drop existing policies with same names to avoid duplicates
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='bookings' and policyname='bookings_delete_owner_or_admin') then
    drop policy bookings_delete_owner_or_admin on public.bookings;
  end if;
end $$;
create policy bookings_delete_owner_or_admin on public.bookings
for delete to public
using (viewer_is_admin() OR (created_by = auth.uid()));

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='bookings' and policyname='bookings_insert_authenticated') then
    drop policy bookings_insert_authenticated on public.bookings;
  end if;
end $$;
create policy bookings_insert_authenticated on public.bookings
for insert to authenticated
with check ((auth.uid() IS NOT NULL) AND (created_by = auth.uid()));

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='bookings' and policyname='bookings_select_all') then
    drop policy bookings_select_all on public.bookings;
  end if;
end $$;
create policy bookings_select_all on public.bookings
for select to public
using (true);

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='bookings' and policyname='bookings_update_owner_or_admin') then
    drop policy bookings_update_owner_or_admin on public.bookings;
  end if;
end $$;
create policy bookings_update_owner_or_admin on public.bookings
for update to public
using (viewer_is_admin() OR (created_by = auth.uid()))
with check (viewer_is_admin() OR (created_by = auth.uid()));

-- profiles policies
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_admin_write') then
    drop policy profiles_admin_write on public.profiles;
  end if;
end $$;
create policy profiles_admin_write on public.profiles
for all to public
using (viewer_is_admin())
with check (viewer_is_admin());

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_insert_self') then
    drop policy profiles_insert_self on public.profiles;
  end if;
end $$;
create policy profiles_insert_self on public.profiles
for insert to authenticated
with check (id = auth.uid());

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_select_self_or_admin') then
    drop policy profiles_select_self_or_admin on public.profiles;
  end if;
end $$;
create policy profiles_select_self_or_admin on public.profiles
for select to public
using ((id = auth.uid()) OR viewer_is_admin());

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_update_self') then
    drop policy profiles_update_self on public.profiles;
  end if;
end $$;
create policy profiles_update_self on public.profiles
for update to public
using (id = auth.uid())
with check (id = auth.uid());

-- 6) Grants (minimal)
grant usage on schema public to anon, authenticated;
grant select on public.profiles_public to anon, authenticated;

-- 7) Notes
-- If you need overlap protection, add a gist exclusion constraint (requires btree_gist):
-- create extension if not exists btree_gist;
-- alter table public.bookings drop constraint if exists bookings_no_overlap;
-- alter table public.bookings
--   add constraint bookings_no_overlap
--   exclude using gist (
--     tstzrange(start_at, end_at, '[)') with &&
--   );

