# Supabase 設定手順

このドキュメントは、会議室予約アプリ用の Supabase スキーマ、制約、RLS ポリシー、補助関数/トリガーを一括で構築するための手順です。

- 対象テーブル: `profiles`, `bookings`
- 主な要件:
  - 予約は重複禁止（半開区間 `[start, end)` で判定）
  - 15 分刻み / 平日 9:00–18:00（JST）内のみ作成・更新可
  - 認証済みのみ作成可。部署はユーザーのプロフィールから自動適用
  - 同部署ユーザーは相互に編集・削除可。管理者は全件編集・削除可
  - 匿名含む全ユーザー閲覧可（SELECT）

---

## 0. 前提

- Supabase プロジェクト作成済み
- Supabase の SQL Editor または CLI で SQL を実行できること
- タイムゾーンは DB 内部では `timestamptz`（UTC）で保存し、業務ルール判定は `Asia/Tokyo` に変換してチェック

---

## 1. 拡張有効化と共通トリガー関数

重複禁止（時系列排他）に `btree_gist` を利用します。あわせて、`updated_at` を自動更新するトリガー関数を用意します（環境により `supabase_functions.update_updated_at` が無い場合があるため、ここで作成します）。

```sql
-- 排他制約用
create extension if not exists btree_gist;

-- タイムスタンプ自動更新トリガー関数
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
```

---

## 2. ヘルパー関数

- `viewer_is_admin()`: 現在のユーザーが管理者か判定
- `viewer_department()`: 現在のユーザーの主部署IDを返却（`profiles.primary_department_id`）

```sql
create or replace function public.viewer_is_admin()
returns boolean
language sql
stable
as $$
  select coalesce((
    select p.is_admin from public.profiles p where p.id = auth.uid()
  ), false);
$$;

create or replace function public.viewer_department()
returns text
language sql
stable
as $$
  select (
    select p.primary_department_id from public.profiles p where p.id = auth.uid()
  );
$$;
```

---

## 3. プロファイルテーブル（前提: 部署マスタ）

まず部署マスタ `departments` を作成し、そこから参照する形にします。

```sql
create table if not exists public.departments (
  id text primary key,                -- 例: 'sales', 'dev'
  name text not null unique,          -- 表示名: '営業部' など
  default_color text not null default '#64748b',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_departments_updated_at
before update on public.departments
for each row execute function supabase_functions.update_updated_at();
```

次に `profiles`。ユーザーは主部署を1つ持ち、`departments` から参照します（複数所属が必要なら中間テーブルで拡張）。

```sql
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  email text not null,
  primary_department_id text not null references public.departments(id) on delete restrict,
  is_admin boolean not null default false,
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function supabase_functions.update_updated_at();
```

RLS ポリシー（列の秘匿性も考慮）:

- テーブル本体は「自分自身」か「管理者」のみ参照可能
- 一般公開用のビュー `public.profiles_public` を作成し、匿名含む全員に公開（`id, display_name, department_id, department_name` のみ）

```sql
alter table public.profiles enable row level security;

-- 自分の行 or 管理者のみ SELECT
create policy profiles_select_self_or_admin on public.profiles
for select using (
  id = auth.uid() or viewer_is_admin()
);

-- 自分の行のみ UPDATE（管理者は別ポリシー）
create policy profiles_update_self on public.profiles
for update using (id = auth.uid())
with check (id = auth.uid());

-- 管理者のみ UPDATE/DELETE 全行
create policy profiles_admin_write on public.profiles
for all using (viewer_is_admin()) with check (viewer_is_admin());

-- 一般公開ビュー
create or replace view public.profiles_public as
  select p.id,
         p.display_name,
         p.primary_department_id as department_id,
         d.name as department_name
  from public.profiles p
  join public.departments d on d.id = p.primary_department_id
  where p.deleted_at is null;

-- ビューは RLS の対象外だが、基表の RLSが適用されるため、
-- 公開用に security definer の関数経由でも可。ここではビュー公開を想定。
```

注意: 「email / is_admin の選択は管理者のみ」という要件は、上記のように基表を管理者と本人のみに限定し、他者向けには公開ビューを利用することで実現します。

---

## 4. 予約テーブル

```sql
create table if not exists public.bookings (
  id bigint generated always as identity primary key,
  title text not null,
  description text not null default '',
  start_at timestamptz not null,
  end_at timestamptz not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  department_id text not null references public.departments(id) on delete restrict,
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
-- 部署ごとに独立させる場合は "department_id with =" を付ける。
alter table public.bookings
  add constraint bookings_no_overlap
  exclude using gist (
    tstzrange(start_at, end_at, '[)') with &&
  );
```

### 自動付与/丸めトリガー

- `created_by` と `department` を現在ユーザーのプロフィールから自動設定
- `start_at`/`end_at` を 15 分刻みに丸め（必要なら無効化してチェックのみでも可）

```sql
create or replace function public.round_to_15min(ts timestamptz)
returns timestamptz
language sql
immutable
as $$
  -- 直近の 15 分グリッドへ丸め（下限）
  select date_trunc('minute', ts) - make_interval(mins => extract(minute from ts)::int % 15);
$$;

create or replace function public.trg_bookings_apply_defaults()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  if new.department_id is null then
    new.department_id := viewer_department();
  end if;
  -- 任意: 15分刻みに丸め（丸めたくない場合は削除）
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

## 5. RLS（bookings）

```sql
alter table public.bookings enable row level security;

-- 誰でも閲覧可（匿名含む）
create policy bookings_select_all on public.bookings
for select using (true);

-- 作成は認証済のみ + 自部署に限定（トリガーで自動設定されるが、with check でも担保）
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

-- 補足: RLS ポリシー内では行の列名をそのまま参照します。
-- トリガーとは異なり `new.` / `old.` という接頭辞は使用できません。
```

---

## 6. 実行手順

1) Supabase SQL Editor を開き、上記セクション 1 → 6 を順に実行（または 1 ファイルにまとめて実行）
2) 部署マスタを投入（例: 営業部を追加）

```sql
insert into public.departments (id, name, default_color) values ('sales', '営業部', '#64748b');
```

3) 認証ユーザー作成後、`profiles` にレコードを作成（`id=auth.users.id`、`primary_department_id` に部署IDを設定）

例:

```sql
insert into public.profiles (id, display_name, email, primary_department_id, is_admin)
values (
  'a7d6984a-6bbf-432a-add2-dd80b0daaa8c',
  '管理者 太郎',
  'admin@example.com',
  'sales',
  true
);
```

---

## 7. 動作確認クエリ

- 15分刻み・営業時間内チェック
- 重複禁止（[start, end)）
- 部署/権限ポリシー

```sql
-- OK: 平日 10:00–11:00（JST）
insert into public.bookings (title, description, start_at, end_at)
values (
  'テスト予約',
  '',
  timestamptz '2025-01-14 10:00+09',
  timestamptz '2025-01-14 11:00+09'
);

-- NG: 10:05 開始（15分刻み違反）
insert into public.bookings (title, description, start_at, end_at)
values (
  '刻み違反',
  '',
  timestamptz '2025-01-14 10:05+09',
  timestamptz '2025-01-14 11:00+09'
);

-- NG: 重複（半開区間）
insert into public.bookings (title, description, start_at, end_at)
values (
  '重複',
  '',
  timestamptz '2025-01-14 10:30+09',
  timestamptz '2025-01-14 11:30+09'
);
```

---

## 8. アプリ連携メモ

- フロントエンドは `profiles_public` を参照して表示名/部署名を取得（`department_id`/`department_name`）。
- 作成時は認証必須。`department_id` / `created_by` はサーバ側で自動適用される設計。
- タイムゾーンはフロントでは JST ベースで扱い、API 送信時は `timestamptz` として送る。

---

## 9. 備考

- 営業時間/曜日の厳密な境界条件は業務ルールに合わせて `chk_business_hours` を調整してください（例: 祝日扱い）。
- 重複禁止を部署単位にしたい場合は、以下のように変更します。

```sql
alter table public.bookings drop constraint if exists bookings_no_overlap;
alter table public.bookings
  add constraint bookings_no_overlap
  exclude using gist (
    department with =,
    tstzrange(start_at, end_at, '[)') with &&
  );
```

以上です。
