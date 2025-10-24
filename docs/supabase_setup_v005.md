## Supabase 設定手順 v005（departments 参照版）

docs/prompt005.md を元に、部署マスタ参照型のスキーマと RLS/制約をまとめます。

- 対象: `profiles`, `departments`, `bookings`
- タイムゾーン: 保存は `timestamptz`（UTC）、判定は JST で実施
- 業務ルール: 15 分刻み・平日 9:00–18:00 内、重複禁止（半開区間）

---

## 0. 前提（拡張/共通関数）

```sql
-- GiST 排他制約や UUID 生成で使用
create extension if not exists btree_gist;
create extension if not exists pgcrypto; -- gen_random_uuid()

-- updated_at 自動更新トリガー
create schema if not exists supabase_functions;
create or replace function supabase_functions.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ログインユーザーの権限/部署を取得
create or replace function public.viewer_is_admin()
returns boolean
language sql stable
as $$
  select coalesce((
    select p.is_admin from public.profiles p where p.id = auth.uid()
  ), false);
$$;

create or replace function public.viewer_department()
returns uuid
language sql stable
as $$
  select (
    select p.department_id from public.profiles p where p.id = auth.uid()
  );
$$;
```

---

## 1. 部署マスタ `departments`

```sql
create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  default_color text not null default '#64748b',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_departments_updated_at
before update on public.departments
for each row execute function supabase_functions.update_updated_at();
```

---

## 2. プロファイル `profiles`

```sql
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  department_id uuid not null references public.departments(id) on delete restrict,
  color_settings text not null default '',
  is_admin boolean not null default false,
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function supabase_functions.update_updated_at();

alter table public.profiles enable row level security;

-- 自分の行 or 管理者のみ SELECT/UPDATE/DELETE を許可（email 等は設計上保持していない）
create policy profiles_select_self_or_admin on public.profiles
for select using (id = auth.uid() or viewer_is_admin());

-- INSERT: 認証ユーザーが自分の行のみ作成可（サインアップ直後にプロフィールを作る想定）
create policy profiles_insert_self on public.profiles
for insert to authenticated
with check (id = auth.uid());

create policy profiles_update_self on public.profiles
for update using (id = auth.uid()) with check (id = auth.uid());

create policy profiles_admin_write on public.profiles
for all using (viewer_is_admin()) with check (viewer_is_admin());

-- 公開用ビュー（匿名含む全員参照可）
create or replace view public.profiles_public as
  select p.id,
         p.display_name,
         p.department_id,
         d.name as department_name,
         p.color_settings
  from public.profiles p
  join public.departments d on d.id = p.department_id
  where p.deleted_at is null;
```

---

## 3. 予約 `bookings`

```sql
create table if not exists public.bookings (
  id bigint generated always as identity primary key,
  title text not null,
  description text not null default '',
  start_at timestamptz not null,
  end_at timestamptz not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  department_id uuid not null references public.departments(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 基本整合性
  constraint chk_time_order check (start_at < end_at),
  constraint chk_min_duration check ((end_at - start_at) >= interval '15 minutes'),
  -- 15分刻み（JST）
  constraint chk_15min_start check (
    extract(minute from (start_at at time zone 'Asia/Tokyo')) in (0,15,30,45)
    and extract(second from start_at) = 0
  ),
  constraint chk_15min_end check (
    extract(minute from (end_at at time zone 'Asia/Tokyo')) in (0,15,30,45)
    and extract(second from end_at) = 0
  ),
  -- 平日 9:00–18:00（JST）
  constraint chk_business_hours check (
    extract(isodow from (start_at at time zone 'Asia/Tokyo')) between 1 and 5 and
    extract(isodow from (end_at   at time zone 'Asia/Tokyo')) between 1 and 5 and
    (start_at at time zone 'Asia/Tokyo')::time >= time '09:00' and
    (end_at   at time zone 'Asia/Tokyo')::time <= time '18:00'
  )
);

create trigger trg_bookings_updated_at
before update on public.bookings
for each row execute function supabase_functions.update_updated_at();

-- 半開区間 [start, end) で重複禁止（全体で一意）。
-- 部署単位で独立させる場合は department_id をキーに含める（下記コメント参照）。
alter table public.bookings
  add constraint bookings_no_overlap
  exclude using gist (
    tstzrange(start_at, end_at, '[)') with &&
  );
```

重複禁止を部署単位にする場合:

```sql
alter table public.bookings drop constraint if exists bookings_no_overlap;
alter table public.bookings
  add constraint bookings_no_overlap
  exclude using gist (
    department_id with =,
    tstzrange(start_at, end_at, '[)') with &&
  );
```

### 自動付与/丸めトリガー

```sql
create or replace function public.round_to_15min(ts timestamptz)
returns timestamptz
language sql immutable
as $$
  select date_trunc('minute', ts) - make_interval(mins => extract(minute from ts)::int % 15);
$$;

create or replace function public.trg_bookings_apply_defaults()
returns trigger
language plpgsql security definer
as $$
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  if new.department_id is null then
    new.department_id := viewer_department();
  end if;
  -- 任意: 丸める場合のみ（丸めたくないなら削除）
  new.start_at := round_to_15min(new.start_at);
  new.end_at   := round_to_15min(new.end_at);
  return new;
end;
$$;

create trigger trg_bookings_defaults
before insert or update on public.bookings
for each row execute function public.trg_bookings_apply_defaults();
```

---

## 4. RLS（bookings）

```sql
alter table public.bookings enable row level security;

-- 誰でも閲覧可（匿名含む）
create policy bookings_select_all on public.bookings
for select using (true);

-- 作成は認証済のみ + 自部署に限定
create policy bookings_insert_authenticated on public.bookings
for insert to authenticated
with check (
  auth.uid() is not null
  and created_by = auth.uid()
  and department_id = viewer_department()
);

-- 更新/削除: 管理者 or 同部署
create policy bookings_update_same_department_or_admin on public.bookings
for update using (
  viewer_is_admin() or department_id = viewer_department()
) with check (
  viewer_is_admin() or department_id = viewer_department()
);

create policy bookings_delete_same_department_or_admin on public.bookings
for delete using (
  viewer_is_admin() or department_id = viewer_department()
);
```

---

## 5. セットアップ手順（例）

```sql
-- 1) 部署作成
insert into public.departments (name, default_color) values ('営業部', '#64748b');
insert into public.departments (name, default_color) values ('開発部', '#22c55e');

-- 2) プロファイル作成（id は auth.users.id を使用）
insert into public.profiles (id, display_name, department_id, color_settings, is_admin)
values (
  'd1231ad8-f710-4b73-bfa8-58b1b607b00e', -- 例
  '管理者 太郎',
  (select id from public.departments where name='営業部'),
  '',
  true
);

-- 3) 動作確認（OK: 平日 10:00–11:00 JST）
insert into public.bookings (title, description, start_at, end_at)
values ('テスト予約', '', timestamptz '2025-01-14 10:00+09', timestamptz '2025-01-14 11:00+09');
```

---

## 6. アプリ実装メモ

- フロントは `profiles_public` から `display_name / department_name / color_settings` を参照
- 作成時に送るのは基本 `title, description, start_at, end_at` のみ（`created_by`/`department_id` は DB 側で自動）
- エラー文言は制約名でハンドリングすると分岐が楽（例: `chk_15min_start` など）

以上です。
