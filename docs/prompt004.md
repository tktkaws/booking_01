# supabase設定手順の作成
supabase設定手順をdocs配下にmdで作成

## 前提条件

### データモデル
- `profiles`: `id (uuid, auth.uid)`, `display_name`, `email`, `departments`, `is_admin boolean`, `deleted_at timestamptz NULL`。
- `bookings`: `id`, `title`, `description`, `start_at timestamptz`, `end_at timestamptz`, `created_by uuid`, `department text`, `created_at`。
- 制約: `start_at < end_at`, 15分刻み、平日/営業時間内のみ。
- RLS 方針:
  - `SELECT`: すべてのユーザー（匿名含む）を許可。
  - `INSERT`: 認証済のみ。`department` は `profiles.department` を自動適用。
  - `UPDATE/DELETE`: `is_admin=true` または `bookings.department = viewer.department`。
  - `profiles` のRLS: 管理者のみ `UPDATE/DELETE/SELECT(email,is_admin)`。一般ユーザーは自分のプロフィール更新と公開項目の閲覧のみ。

### 権限/業務ルール
- 競合禁止: 予約は重複不可（半開区間でチェック）。
- 部署権限: 同部署ユーザーは相互に編集/削除可。管理者は全予約/全ユーザー管理可。
- 時間制約: 平日 9:00–18:00 以外は作成/更新不可。15分単位へ丸め/バリデーション。

### バリデーション規則
- 15分刻み: `start_at`/`end_at` は 00/15/30/45 分のみ。
- 営業時間: 平日 9:00–18:00 内、かつ `end_at-start_at >= 15m`。
- 競合: `[start, end)` 区間で重複禁止。
- 日本時間（JST）で運用