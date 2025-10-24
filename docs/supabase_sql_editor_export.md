# Supabase SQL Editor を用いたスキーマ/RLSエクスポート

この手順では Supabase ダッシュボードの SQL Editor だけを使って、テーブル構造や RLS（行レベルセキュリティ）を SQL 文字列として取得・保存する方法をまとめます。CLI や `pg_dump` が使えない環境でも実行できます。

## 前提
- Supabase プロジェクトにアクセスできる（ダッシュボードにログインできる）
- 対象スキーマ例: `public, auth, storage`（必要に応じて変更）
- 出力は SQL Editor の結果を「Download」やコピーで保存

## 手順概要
1. SQL Editor を開く（Dashboard → SQL → New query）
2. 以降のクエリを用途ごとに実行し、結果を保存（CSV/JSON またはテキストとしてコピー）

---

## 1) テーブルの基本 DDL（CREATE TABLE; 列定義のみ）
- 目的: 各テーブルの列・型・NOT NULL・DEFAULT・IDENTITY を含む `CREATE TABLE` を生成
- 注意: ここでは制約（PK/FK/UNIQUE/CHECK）やインデックスは含みません。後続セクションで生成します。

```sql
WITH cols AS (
  SELECT
    c.table_schema,
    c.table_name,
    c.ordinal_position,
    format(
      '%I %s%s%s%s',
      c.column_name,
      CASE
        WHEN c.data_type IN ('character varying','character','varchar','char') AND c.character_maximum_length IS NOT NULL
          THEN format('%s(%s)', CASE WHEN c.data_type IN ('varchar','char') THEN 'character varying' ELSE c.data_type END, c.character_maximum_length)
        WHEN c.data_type IN ('numeric','decimal') AND c.numeric_precision IS NOT NULL
          THEN format('%s(%s%s)', c.data_type, c.numeric_precision, COALESCE(','||c.numeric_scale,''))
        ELSE c.data_type
      END,
      CASE WHEN c.identity_generation IS NOT NULL THEN ' GENERATED '||c.identity_generation||' AS IDENTITY' ELSE '' END,
      CASE WHEN c.column_default IS NOT NULL AND c.identity_generation IS NULL THEN ' DEFAULT '||c.column_default ELSE '' END,
      CASE WHEN c.is_nullable='NO' THEN ' NOT NULL' ELSE '' END
    ) AS coldef
  FROM information_schema.columns c
  WHERE c.table_schema NOT IN ('pg_catalog','information_schema')
)
SELECT format(
  'CREATE TABLE %I.%I (\n  %s\n);\n',
  table_schema,
  table_name,
  string_agg(coldef, ',\n  ' ORDER BY ordinal_position)
) AS ddl
FROM cols
GROUP BY table_schema, table_name
ORDER BY table_schema, table_name;
```

---

## 2) 主キー（PRIMARY KEY）DDL
```sql
WITH pk AS (
  SELECT tc.table_schema, tc.table_name, tc.constraint_name,
         string_agg(quote_ident(kcu.column_name), ', ' ORDER BY kcu.ordinal_position) AS cols
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
   AND tc.table_schema = kcu.table_schema
  WHERE tc.constraint_type = 'PRIMARY KEY'
  GROUP BY 1,2,3
)
SELECT format(
  'ALTER TABLE %I.%I ADD CONSTRAINT %I PRIMARY KEY (%s);',
  table_schema, table_name, constraint_name, cols
) AS ddl
FROM pk
ORDER BY table_schema, table_name;
```

---

## 3) 外部キー（FOREIGN KEY）DDL
```sql
WITH fks AS (
  SELECT
    n.nspname AS schema,
    cl.relname AS table,
    con.conname AS constraint_name,
    nf.nspname AS ref_schema,
    clf.relname AS ref_table,
    con.confupdtype,
    con.confdeltype,
    k.ord,
    att.attname  AS col,
    attf.attname AS ref_col
  FROM pg_constraint con
  JOIN pg_class cl ON cl.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = cl.relnamespace
  JOIN pg_class clf ON clf.oid = con.confrelid
  JOIN pg_namespace nf ON nf.oid = clf.relnamespace
  JOIN LATERAL unnest(con.conkey)  WITH ORDINALITY AS k(colattnum, ord) ON true
  JOIN LATERAL unnest(con.confkey) WITH ORDINALITY AS fk(colattnum, ord) ON fk.ord = k.ord
  JOIN pg_attribute att  ON att.attrelid  = con.conrelid AND att.attnum  = k.colattnum
  JOIN pg_attribute attf ON attf.attrelid = con.confrelid AND attf.attnum = fk.colattnum
  WHERE con.contype = 'f'
), agg AS (
  SELECT
    schema, table, constraint_name, ref_schema, ref_table,
    string_agg(quote_ident(col), ', ' ORDER BY ord)     AS cols,
    string_agg(quote_ident(ref_col), ', ' ORDER BY ord) AS ref_cols,
    min(confupdtype) AS confupdtype,
    min(confdeltype) AS confdeltype
  FROM fks
  GROUP BY 1,2,3,4,5
)
SELECT format(
  'ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%s) REFERENCES %I.%I (%s)%s%s;',
  schema, table, constraint_name, cols, ref_schema, ref_table, ref_cols,
  CASE confdeltype
    WHEN 'a' THEN ''
    WHEN 'r' THEN ' ON DELETE RESTRICT'
    WHEN 'c' THEN ' ON DELETE CASCADE'
    WHEN 'n' THEN ' ON DELETE SET NULL'
    WHEN 'd' THEN ' ON DELETE SET DEFAULT'
    ELSE ''
  END,
  CASE confupdtype
    WHEN 'a' THEN ''
    WHEN 'r' THEN ' ON UPDATE RESTRICT'
    WHEN 'c' THEN ' ON UPDATE CASCADE'
    WHEN 'n' THEN ' ON UPDATE SET NULL'
    WHEN 'd' THEN ' ON UPDATE SET DEFAULT'
    ELSE ''
  END
) AS ddl
FROM agg
ORDER BY schema, table, constraint_name;
```

---

## 4) インデックス DDL
- 既存インデックス（ユニーク含む）を `CREATE INDEX` 形式で取得
```sql
SELECT format('%s;', pg_get_indexdef(i.indexrelid)) AS ddl
FROM pg_index i
JOIN pg_class ic ON ic.oid = i.indexrelid
JOIN pg_class tc ON tc.oid = i.indrelid
JOIN pg_namespace n ON n.oid = tc.relnamespace
WHERE n.nspname NOT IN ('pg_catalog','information_schema')
ORDER BY n.nspname, tc.relname, ic.relname;
```

---

## 5) RLS ポリシー DDL（CREATE POLICY）
- すべてのポリシーを `CREATE POLICY` 文として生成（`AS RESTRICTIVE` は必要時のみ付与）
```sql
SELECT string_agg(ddl, E'\n') AS sql
FROM (
  SELECT format(
    'CREATE POLICY %I ON %I.%I%s FOR %s TO %s%s%s;',
    p.policyname,
    p.schemaname,
    p.tablename,
    CASE WHEN NOT p.permissive THEN ' AS RESTRICTIVE' ELSE '' END,
    CASE WHEN p.cmd = 'ALL' THEN 'ALL' ELSE lower(p.cmd) END,
    COALESCE(
      NULLIF(array_to_string(ARRAY(SELECT quote_ident(r) FROM unnest(p.roles) AS r), ', '), ''),
      'PUBLIC'
    ),
    CASE WHEN p.qual IS NOT NULL AND p.cmd IN ('SELECT','ALL')
      THEN format(' USING (%s)', p.qual) ELSE '' END,
    CASE WHEN p.with_check IS NOT NULL AND p.cmd IN ('INSERT','UPDATE','ALL')
      THEN format(' WITH CHECK (%s)', p.with_check) ELSE '' END
  ) AS ddl
  FROM pg_policies p
  ORDER BY p.schemaname, p.tablename, p.policyname
) s;
```

---

## 6) RLS の有効化/強制フラグ（ALTER TABLE ... ENABLE/FORCE RLS）
- RLS が有効なテーブルのみ出力（`FORCE` 設定も付与）
```sql
SELECT string_agg(stmt, E'\n') AS sql
FROM (
  SELECT format(
    'ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY%s;',
    n.nspname, c.relname,
    CASE WHEN c.relforcerowsecurity THEN ' FORCE' ELSE '' END
  ) AS stmt
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind = 'r'
    AND c.relrowsecurity
    AND n.nspname NOT IN ('pg_catalog','information_schema')
  ORDER BY n.nspname, c.relname
) t;
```

---

## 7) ビュー/関数/トリガーの DDL（必要に応じて）
### ビュー
```sql
SELECT string_agg(
  format('CREATE OR REPLACE VIEW %I.%I AS\n%s;', schemaname, viewname, definition),
  E'\n\n'
) AS sql
FROM pg_views
WHERE schemaname NOT IN ('pg_catalog','information_schema')
ORDER BY schemaname, viewname;
```

### 関数
```sql
SELECT string_agg(pg_get_functiondef(p.oid), E'\n\n') AS sql
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname IN ('public','auth','storage')  -- 必要に応じて変更
ORDER BY n.nspname, p.proname;
```

### トリガー
```sql
SELECT string_agg(
  format('CREATE TRIGGER %I %s;', t.tgname, pg_get_triggerdef(t.oid, true)),
  E'\n'
) AS sql
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE NOT t.tgisinternal
  AND n.nspname NOT IN ('pg_catalog','information_schema')
ORDER BY n.nspname, c.relname, t.tgname;
```

---

## 8) 保存方法のヒント
- 1つのステートメントごとに1行で返るクエリは、結果ペイン右上の「Download」から CSV/JSON として保存可
- `string_agg` で 1 カラムに統合したクエリは、結果セルをコピーして `.sql` として保存
- 復元テスト用: 生成した順に適用（`CREATE TABLE` → 制約/インデックス → RLS 有効化 → ポリシー → ビュー/関数/トリガー）

## 注意事項
- ここで生成する DDL は一般的な再現用を想定。細かい所有者/権限、拡張作成、コメントなどは含まれません
- Postgres バージョン差異により出力やサポート構文が変わることがあります（Supabase は PostgreSQL 15/16 系）
- 完全再現が必要な場合は、Supabase CLI や `pg_dump` によるスキーマダンプも検討してください

