## Supabase ログイン実装手順（Next.js App Router）

このドキュメントでは、本プロジェクト（Next.js App Router）に Supabase を接続し、ログイン（Email/Magic Link と OAuth）を実装する最短手順をまとめます。

---

## 1. 前提・準備

- Supabase プロジェクト作成済み
- コンソールで以下を確認/有効化
  - Authentication > Providers
    - Email（Magic Link/OTP）を ON（または Email+Password）
    - 必要な OAuth（Google/GitHub など）を ON
  - Authentication > URL Configuration
    - Site URL（ローカル開発時は `http://localhost:3000`）
    - Redirect URLs に `http://localhost:3000/auth/callback` を登録
- Supabase のプロジェクト URL と匿名キー（anon key）を取得

環境変数（.env.local）:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 2. パッケージ導入

Next.js App Router で SSR/CSR 両対応の認証を簡単に扱うため、公式の SSR ヘルパーを使います。

```
npm i @supabase/supabase-js @supabase/ssr
```

---

## 3. Supabase クライアントの初期化

ブラウザ（クライアント）とサーバでクライアントを分けます。

`app/lib/supabase/browser.ts`（CSR 用）:

```ts
// app/lib/supabase/browser.ts
import { createBrowserClient } from '@supabase/ssr'

export const createSupabaseBrowserClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
```

`app/lib/supabase/server.ts`（SSR 用）:

```ts
// app/lib/supabase/server.ts
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export const createSupabaseServerClient = () => {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )
}
```

---

## 4. OAuth コールバック Route

OAuth でサインイン後にセッション Cookie を設定するためのコールバックを用意します。

`app/auth/callback/route.ts`:

```ts
// app/auth/callback/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  // Supabase のホスト名に合わせてクッキーをそのまま引き継ぐだけでOKな場合が多いですが、
  // 何もせずトップへ返すシンプルな実装でも動作します。
  const url = new URL(request.url)
  const redirectTo = url.searchParams.get('redirect_to') || '/'
  // 必要に応じて state 検証などを挟む
  return NextResponse.redirect(new URL(redirectTo, url.origin))
}
```

注意: プロバイダ設定のリダイレクト URL に `/auth/callback` を登録しておきます。

---

## 5. ログイン UI（ページ）

Email（Magic Link）と OAuth ボタンの簡易 UI 例です。

`app/login/page.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'

export default function LoginPage() {
  const supabase = createSupabaseBrowserClient()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const signInWithMagicLink = async () => {
    setLoading(true)
    setMessage(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    setLoading(false)
    setMessage(error ? error.message : 'メールを送信しました。確認してください。')
  }

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) setMessage(error.message)
  }

  return (
    <div className="mx-auto max-w-sm p-6">
      <h1 className="mb-4 text-xl font-bold">ログイン</h1>
      <div className="mb-4 space-y-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          className="w-full rounded border px-3 h-9 grid items-center"
        />
        <button
          disabled={loading}
          onClick={signInWithMagicLink}
          className="w-full rounded bg-blue-600 px-3 h-9 grid items-center text-white"
        >
          {loading ? '送信中...' : 'Magic Link を送る'}
        </button>
      </div>
      <div className="mb-2 text-center text-sm text-slate-800">または</div>
      <button
        onClick={signInWithGoogle}
        className="w-full rounded bg-slate-800 px-3 h-9 grid items-center text-white"
      >
        Google でログイン
      </button>
      {message && <p className="mt-3 text-sm text-slate-800">{message}</p>}
    </div>
  )
}
```

サインアウト（任意のクライアントコンポーネント内）:

```tsx
const supabase = createSupabaseBrowserClient()
await supabase.auth.signOut()
```

---

## 6. セッション取得と保護（サーバーサイド）

App Router のページ/レイアウトで SSR セッションを取得し、未ログインなら `/login` に誘導する例です。

任意の保護ページ（例: `app/protected/page.tsx`）:

```tsx
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function ProtectedPage() {
  const supabase = createSupabaseServerClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) redirect('/login')

  return <div>認証済み: {session.user.email}</div>
}
```

トップや既存ページのヘッダーに「ログイン/ログアウト」導線を追加しても良いでしょう。

---

## 7. Supabase 側の設定ポイント（再掲）

- Authentication > URL Configuration
  - Site URL: `http://localhost:3000`
  - Redirect URLs: `http://localhost:3000/auth/callback`
- Authentication > Providers
  - Email: 有効（Magic Link/OTP、または Email+Password）
  - Google/GitHub 等の OAuth: クライアントID/シークレットを登録

---

## 8. よくあるハマりどころ

- リダイレクト URL 不一致: Supabase 側の Redirect URLs とアプリ側の `/auth/callback` が一致していない
- 環境変数の漏れ: `NEXT_PUBLIC_...` の接頭辞を付け忘れるとブラウザから参照できない
- Cookie/ドメイン: ローカルでも `http://localhost:3000` で統一して動作確認
- SQL エディタでの手動 INSERT: `auth.uid()` は null になるため、トリガーに頼らず列を明示する

---

## 9. 次のステップ（DB連携）

ログイン後、RLS を有効化したテーブルに対してフロントから `supabase.from(...).select(...)` などでアクセスできます。SSR でデータ取得が必要な場合は `createSupabaseServerClient()` を用いて、サーバー側でセッションに基づくクエリを実行してください。

以上です。
