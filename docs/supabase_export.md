# Supabase スキーマ/RLS エクスポート手順

## 目的
- 対象: テーブル構造（DDL）、RLSポリシー、拡張・関数・トリガー等のスキーマ
- 結論: Supabase CLI または `pg_dump` を使うのが最も確実。RLSはスキーマダンプ内の `CREATE POLICY` と `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` として含まれる

## 前提準備
- Supabase CLI: インストール済み（`supabase --version` で確認）
- 権限: プロジェクトのDB接続情報（`DATABASE_URL` か DBパスワード）、または CLI でプロジェクトを link 済み
- 出力先: 任意のフォルダ（例: `export/`）

## 方法A（推奨）: Supabase CLIでスキーマを一括ダンプ
### ログイン
```bash
supabase login
```

### プロジェクトを紐付け（どちらか）
- プロジェクト参照でリンク:
```bash
supabase link --project-ref <your-project-ref> --password <db-password>
```
- もしくは DB URL を使う（例）:
```bash
export DATABASE_URL="postgresql://postgres:<db-password>@db.<ref>.supabase.co:5432/postgres"
```

### スキーマのみダンプ（RLS含む）
- リンク済みプロジェクトから:
```bash
supabase db dump -f export/schema.sql --linked --schema public,auth,storage
```
- DB URLを直接指定:
```bash
supabase db dump -f export/schema.sql --db-url "$DATABASE_URL" --schema public,auth,storage
```
- メモ:
  - `--schema` に `public,auth,storage` を含めると一般的なオブジェクトとストレージ/認証周りも拾える
  - RLSは `CREATE POLICY` と `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` として出力される

### データも含めたい場合（任意）
```bash
supabase db dump -f export/full.sql --db-url "$DATABASE_URL" --schema public,auth,storage --data
```
注意: データは機密情報含む可能性あり。用途に応じて使い分け

## 方法B: 標準ツール（pg_dump）でスキーマダンプ
### スキーマのみ（所有者・権限行は除外して可搬性UP）
```bash
pg_dump "$DATABASE_URL" \
  --schema-only \
  --no-owner --no-privileges \
  --schema=public --schema=auth --schema=storage \
  --file export/schema.sql
```

### 確認ポイント
- 出力内に `CREATE POLICY`、`ALTER TABLE ... ENABLE ROW LEVEL SECURITY` が含まれていること
- 必要に応じて対象スキーマを追加（例: `graphql_public` など）

## RLSのみの一覧を抽出（オプション）
### ポリシー一覧（タブ区切りで出力）
```bash
psql "$DATABASE_URL" -At -F $'\t' -c \
"select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
 from pg_policies
 order by 1,2,3;" > export/rls_policies.tsv
```

### 有効化状況（テーブルごとのRLSフラグ）
```bash
psql "$DATABASE_URL" -At -F $'\t' -c \
"select schemaname, relname as table, relrowsecurity as rls_enabled
 from pg_catalog.pg_class c
 join pg_catalog.pg_namespace n on n.oid=c.relnamespace
 where relkind='r'
 order by 1,2;" > export/rls_enabled_tables.tsv
```

## 型や補助出力（任意）
### TypeScript型を生成（アプリ側の契約管理に便利）
```bash
supabase gen types typescript --db-url "$DATABASE_URL" --schema public > export/types.ts
```

## 復元・検証
### 復元（別環境へ適用）
```bash
psql "$TARGET_DATABASE_URL" -f export/schema.sql
```

### 検証
- ダンプ内で `CREATE TABLE` / `CREATE POLICY` が想定どおり出力されているか確認
- 復元先で `select * from pg_policies;` を確認

## 運用Tips
- 可搬性: 共有・CI用には `--no-owner --no-privileges` を付与して環境依存を低減
- 対象スキーマ: `public, auth, storage` 以外を使っている場合は必ず明示追加
- 差分生成: 変更の履歴管理は `supabase db diff`（ローカル⇔リモートの差分からマイグレーション生成）
```bash
supabase db diff -f supabase/migrations/$(date +%Y%m%d%H%M%S)_change.sql --use-migra --db-url "$DATABASE_URL"
```
- 除外: ダンプはDB内オブジェクトのみ。ダッシュボード設定（Authプロバイダ設定等）は別途エクスポートが必要

