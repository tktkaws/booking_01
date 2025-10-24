# ログイン・サインアップ機能 実装メモ（prompt006）

本リポジトリに以下を追加実装しました。

- ヘッダーに「ログイン」ボタン（認証済みならメールと「ログアウト」）
- モーダルでログイン／サインアップを切り替え（Email + Password のみ）

## 1. 追加/変更ファイル

- `app/lib/supabase/browser.ts`: Supabase ブラウザクライアント
- `app/components/auth/AuthModal.tsx`: ログイン/サインアップ用モーダル
- `app/components/auth/AuthButton.tsx`: ヘッダーのボタン（ログイン/ログアウト）
- `app/page.tsx`: ヘッダーに `AuthButton` を組み込み

## 2. 必要な環境変数（.env.local）

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## 3. パッケージのインストール

```
npm i @supabase/supabase-js
```

（ネットワーク権限が必要。未導入のまま起動するとビルドで型解決/依存が欠落します）

## 4. Supabase 側の設定（Email のみ・確認メールなし）

- Authentication > Providers > Email
  - 「Email」サインイン方法を有効化
  - Email 確認メールを送信しない設定（Confirm Email を OFF、もしくは Auto Confirm を ON）
    - これにより `auth.signUp` の直後にセッションが発行されます

## 5. 使い方

- 右上「ログイン」→ モーダルで Email/Password を入力してログイン
- 「サインアップに切り替え」でユーザー登録
- 認証済みになるとヘッダー右にメールと「ログアウト」ボタンが表示されます

## 6. 補足

- 本実装は Email/Password のみを想定。Magic Link/OAuth を使う場合は `docs/supabase_auth_setup.md` を参照
- サインアップ時にセッションが返らない設定の場合、モーダルに「サインアップしました。ログインしてください。」と表示されます（Email 確認が必要なモード）

