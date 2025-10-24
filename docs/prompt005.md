# supabase設定手順の作成
supabase設定手順をdocs配下にmdで作成

## 前提条件

### テーブル設計
- `profiles`
- `departments`
- `bookings`

#### profilesテーブル
- id(uuid, auth.uid)
- display_name
- department_id(department.id)
- color_settings(text)

#### departmentsテーブル
- id(uuid, auth.uid)
- name
- default_color(text)

#### bookingsテーブル
- `id`
- `title`
- `description`
- `start_at timestamptz`
- `end_at timestamptz`
- `created_by uuid`
- `department_id(profile.department.id)`

### 権限/業務ルール
- 競合禁止: 予約は重複不可（半開区間でチェック）。
- 部署権限: 同部署ユーザーは相互に編集/削除可。管理者は全予約/全ユーザー管理可。
- 時間制約: 平日 9:00–18:00 以外は作成/更新不可。15分単位へ丸め/バリデーション。

### バリデーション規則
- 15分刻み: `start_at`/`end_at` は 00/15/30/45 分のみ。
- 営業時間: 平日 9:00–18:00 内、かつ `end_at-start_at >= 15m`。
- 競合: `[start, end)` 区間で重複禁止。
- 日本時間（JST）で運用