-- prompt011: profiles.color_settings を text から jsonb へ移行し、
-- 部署ごとのカラー設定を格納できるようにします。

begin;

-- 0) 依存ビューを一時的に削除（型変更のブロッカー）
drop view if exists public.profiles_public;

-- 1) 既定値を外してから型変更（空文字は空オブジェクトに）
alter table public.profiles alter column color_settings drop default;
alter table public.profiles
  alter column color_settings type jsonb
  using (
    case
      when color_settings is null or trim(color_settings) = '' then '{}'::jsonb
      else color_settings::jsonb
    end
  );

-- 2) デフォルトを {} に、NOT NULL を維持/付与
alter table public.profiles alter column color_settings set default '{}'::jsonb;
update public.profiles set color_settings = '{}'::jsonb where color_settings is null;
alter table public.profiles alter column color_settings set not null;

-- 3) 公開ビューを再作成（jsonb を含む）
create view public.profiles_public as
  select p.id,
         p.display_name,
         p.department_id,
         d.name as department_name,
         p.color_settings
  from public.profiles p
  left join public.departments d on d.id = p.department_id;

-- 4) 権限（再作成したため再付与）
grant select on public.profiles_public to anon, authenticated;

commit;

-- 格納形式（例）:
-- {
--   "<department_uuid>": "#64748b",
--   "<another_dep_uuid>": "#334155"
-- }
-- 必要に応じて text_color を含める場合は、
-- {
--   "sales": {"color": "#64748b", "textColor": "#ffffff"}
-- }
-- のように構造化し、アプリ側で対応させてください。
