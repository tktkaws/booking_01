# 予約のリアルタイムバリデーションの仕組み

本プロジェクトにおける「リアルタイム」バリデーションは、予約作成/編集モーダルでユーザーが日時を変更するたびに、DBへ重複確認クエリを投げて即時に可否をフィードバックする設計です。送信時にも同条件で再チェックし、競合や取りこぼしを防ぎます。

## 対象コード
- モーダル: `app/components/modal/CreateBookingModal.tsx`
- 一覧の再読込: `app/page.tsx`（`window.dispatchEvent("bookings:changed")` を契機に再フェッチ）

## 予約の時間表現
- DB: `bookings` テーブルの `start_at` / `end_at`（`timestamptz`）
- UI→DB 送信: `YYYY-MM-DDTHH:mm:00+09:00`（JST 固定）を組み立て
- 時間帯の重複判定は半開区間 `[start, end)` 前提で実装

## 入力中のリアルタイム重複チェック
- 対象イベント: `date` または `start` 変更時（`useEffect` で監視）
- 実装概要:
  ```ts
  const start_at = `${date}T${start}:00+09:00`;
  const end_at   = `${date}T${end}:00+09:00`;

  let query = supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .lt("start_at", end_at)  // 既存の開始が新規の終了より前
    .gt("end_at", start_at); // 既存の終了が新規の開始より後

  // 編集時は自分自身の行を除外
  if (mode === "edit") query = query.neq("id", Number(initialBooking.id));

  const { count } = await query; // 件数のみ（HEAD）
  setHasConflict((count ?? 0) > 0);
  ```
- UI フィードバック:
  - `checkingConflict` 中は「重複をチェック中…」を表示
  - `hasConflict=true` なら「既存の予約と重複しています。」、そうでなければ「予約可能です」
- 目的: 入力中に即時の可否を提示して操作回数を削減し、ミスを早期に発見

## 送信時の最終バリデーション（二重チェック）
- エッジケース（同時更新・通信失敗時の見逃し）に備え、送信時に同一条件で再確認してから `insert/update` 実行
- 送信前の追加チェック:
  - `end > start`（UIでは終了候補は開始より後のみを提示するが、最終ガードとして再確認）
- 衝突時の挙動: アラートで通知し、保存は行わない

## 候補時間と日別状況の補助
- 終了候補の自動調整: 開始変更時に `+60分` を目安に最小のスロットを自動選択
- 終了プルダウンは開始より後のスロットのみ表示
- 同日予約の一覧表示: モーダル右側に該当日の既存予約を表示（視覚的に重複を把握しやすくする）
  - データ供給: 親コンポーネントで作成した `bookingsByDate`（`Map<dateKey, ParsedBooking[]>`）

## データの更新通知（ページ内）
- 予約の作成/更新/削除後に `window.dispatchEvent(new CustomEvent("bookings:changed"))` を発火
- `app/page.tsx` 側でリスンし、`bookings` を再フェッチして UI を更新
- 備考: 現状はブラウザ内の擬似リアルタイム（他クライアントとの同期は後述）

## RLS と権限上の前提
- リアルタイム重複チェックには、少なくとも `bookings(start_at, end_at)` への `SELECT` 権限が必要
- RLS を有効化している場合は、重複確認に必要な行が取得できるポリシーを用意する
  - 例: 予約時間の閲覧のみ許可する読み取りポリシー（必要に応じて列レベル権限やビューを活用）

## 制限事項と将来拡張
- 制限事項:
  - 他クライアントでの同時編集は、送信時の再チェックで検出する前提（UI更新はページ内イベントベース）
- 拡張案（真のリアルタイム化）:
  - Supabase Realtime を利用して `bookings` の `INSERT/UPDATE/DELETE` を購読し、即時反映
    ```ts
    const channel = supabase.channel('bookings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        loadBookings(); // 再フェッチ or 差分適用
      })
      .subscribe();
    ```
  - 送信時の再チェックは継続（競合回避の最終防衛線）

## まとめ
- 入力中: `start_at < new_end` かつ `end_at > new_start` のクエリで重複件数を即時計測
- 送信前: 同条件で再チェックしてから保存（競合/同時更新への対処）
- UI: 状態表示と日別の既存予約提示で、重複の気付きやすさを向上
- RLS: 時間帯判定に必要な参照が可能となるポリシー設計が前提
