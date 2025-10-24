## なぜこの設定にするか（v005 版・フロント向け）

docs/prompt005.md の要件に沿って、部署マスタ参照型の設計理由を要点で解説します。

---

## 部署をテーブル分離する理由（departments）

- 正規化: 部署名や色を一元管理でき、綴り違い・色のばらつきを防止
- 参照整合: `profiles.department_id` / `bookings.department_id` は FK で保証され、存在しない部署を指さない
- 表示最適化: 部署表示名や色を JOIN で取得（`profiles_public` でまとめて露出）

---

## UUID 採用の理由

- 衝突しにくく、移行/分割/統合にも強い汎用キー
- Supabase では `gen_random_uuid()`（pgcrypto）で容易に発行可能

---

## profiles の `department_id` と `color_settings`

- department_id: 主部署を 1 つ持たせることで権限判定（同部署か）をシンプルに
- color_settings: ユーザーごとの配色カスタム（テーマ）を保持（テキストで十分なら text、将来の柔軟性を見込むなら JSON も可）

---

## RLS の方針（bookings）

- SELECT: 誰でも閲覧可（公開カレンダー想定）
- INSERT: 認証済のみ + 自部署限定（`created_by = auth.uid()` と `department_id = viewer_department()` で担保）
- UPDATE/DELETE: 管理者 or 同部署のみ

DB 側に最終関門を置くので、フロントや API の実装ミスでも不正操作を防止できます。

---

## 15 分刻み・営業時間・重複禁止を DB で担保

- UX のためのクライアント側チェックに加え、DB 側の `check`/`exclusion` で「入れさせない」
- 半開区間 `[start, end)` にすることで、10:00–10:30 と 10:30–11:00 を非重複として扱える
- 判定は JST に統一（保存は `timestamptz` で UTC）

---

## 部署単位の重複禁止に切り替えられる設計

- 業務によっては「部署内の会議室が独立」などがあるため、排他制約に `department_id with =` を足せるようにしている
- 要件次第で全体 or 部署単位を選択可能

---

## 公開ビュー `profiles_public` の狙い

- 表示用に必要最小限の情報（`display_name`, `department_name`, `color_settings`）を公開
- 機微情報があっても分離しやすい（今回は email を保持していない設計）

---

## フロント実装への影響

- 送信項目は最小限（`title/description/start_at/end_at`）で OK
- `created_by`/`department_id` は DB 側が安全に補完
- 表示は `profiles_public` を参照してラベル/色を取得

---

## よくある落とし穴

- RLS の式で `new.`/`old.` を使わない（列名はそのまま）
- `btree_gist`/`pgcrypto` 拡張を忘れると重複禁止/UUID 生成が失敗
- タイムゾーン変換を忘れると、見かけの時刻と DB 判定が一致しない

---

## まとめ

- 部署マスタ分離 + FK により整合性と見通しが向上
- RLS と制約で DB が最終防衛線となり、フロントは UX に集中できる
- 変更に強い UUID と可搬性の高い宣言的ルールで長期運用に耐える

