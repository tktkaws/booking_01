# 開始・終了時間を選択するフォームのベストプラクティス

本ドキュメントは、開始・終了時間を選択するフォームの実装指針です。要件は「9:00〜18:00、15分刻み、リアルタイムバリデーションで無効化（disabled）制御」を前提に記載します。

## 目的と要件
- 目的: ユーザーが迷わず、開始・終了の整合性を保って時間帯を選べること。
- 範囲: 09:00〜18:00（24h表記、先頭ゼロで統一）。
- 刻み: 15分刻み（例: 09:00, 09:15, 09:30, ...）。
- 整合性: 開始 < 終了 を常に満たす。
- リアルタイム: 片方の値変更で、もう片方の選択肢を即時に disabled 更新。

## UI パターンの選択
- セレクト2つ（開始/終了）
  - 最小実装コスト。モバイルでも標準ピッカーが使える。
  - 候補が短い（36件）ためリストでも許容。
- ポップオーバー型（details/summary やカスタムポップオーバー）
  - 視覚的に見やすいグリッド表示が可能。
  - キーボード/スクリーンリーダー対応を入れる場合は ARIA 設計が必要。
- コンボボックス（検索できる入力 + 候補）
  - 候補数が多い/検索したい時に有効だが、今回は過剰になりやすい。

推奨: まずはセレクト2つで実装し、必要に応じてポップオーバーへ拡張。

## アクセシビリティ（A11y）
- 各入力に `label` を関連付け（例: 「開始」「終了」）。
- エラーはテキストで明示し、`aria-describedby` でひも付ける。
- カスタム UI の場合は `role="listbox"`/`role="option"`、`aria-activedescendant`、キーボード操作（Tab/Enter/Esc/矢印）を整備。
- フォーカス可視化（focus ring）と十分なコントラストを確保。

## リアルタイムバリデーションと無効化ルール
- スロット生成: 09:00〜18:00 を 15分刻みで事前生成（`TIME_SLOTS`）。
- 非同期/同期の両方で整合性を担保:
  - フロント: 片方変更時にもう片方の候補を再計算し、無効化（`disabled`）。
  - サーバー: 送信時にも `start < end` を必ず検証。
- 無効化の境界条件:
  - 開始の最大は 17:45（終了の最小 09:15 との整合のため）。
  - 終了は 09:15〜18:00 を許容（開始と同値・以前は disabled）。
- 選択値が無効化に巻き込まれた場合の挙動:
  - 推奨1: 自動調整（例: 開始変更で終了を +60分へシフト）。
  - 推奨2: 値は保持し、エラー表示で明示（確定操作をブロック）。

## UX のこだわり
- 初期値: 現在時刻の「次の15分」から1時間枠を自動提案（例: 09:10 → 09:15〜10:15）。
- 表記統一: 常に `HH:mm`（先頭ゼロ）で表示。ホバーで「9:00–18:00（15分刻み）」など補足も可。
- モバイル: ネイティブセレクト優先。ポップオーバーは表示位置/スクロールを壊さない。
- エラー: 上部もしくは各入力直下に簡潔なメッセージ（例: 「終了は開始より後にしてください」）。

## 実装例（React/TypeScript）
```tsx
const TIME_SLOTS = (() => {
  const out: string[] = [];
  for (let h = 9; h <= 18; h++) {
    for (const m of [0, 15, 30, 45]) {
      const hh = String(h).padStart(2, '0');
      const mm = String(m).padStart(2, '0');
      out.push(`${hh}:${mm}`);
    }
  }
  return out;
})();

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

function useTimeRange(initialStart = '09:00', initialEnd = '10:00') {
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);

  const endOptions = useMemo(() =>
    TIME_SLOTS.filter(t => toMin(t) > toMin(start) && toMin(t) >= toMin('09:15')), [start]
  );
  const startOptions = useMemo(() =>
    TIME_SLOTS.filter(t => toMin(t) < toMin(end) && toMin(t) <= toMin('17:45')), [end]
  );

  // 自動調整（開始変更時に +60分へ）
  const onStartChange = (v: string) => {
    setStart(v);
    const target = toMin(v) + 60;
    const next = TIME_SLOTS.find(t => toMin(t) >= target) ?? endOptions[0] ?? '09:30';
    setEnd(next);
  };

  // 終了変更時は単純セット（無効値は UI 側 disabled で未選択）
  const onEndChange = (v: string) => setEnd(v);

  return { start, end, startOptions, endOptions, onStartChange, onEndChange };
}
```

UI は以下のように `select` で実装できます（disabled によるブロックを前提に、submit 時も再検証）。

```tsx
<label>
  開始
  <select value={start} onChange={e => onStartChange(e.target.value)}>
    {TIME_SLOTS.map(t => (
      <option key={t} value={t} disabled={toMin(t) > toMin('17:45') || toMin(t) >= toMin(end)}>
        {t}
      </option>
    ))}
  </select>
  <small>09:00〜17:45まで選択可</small>
  </label>
<label>
  終了
  <select value={end} onChange={e => onEndChange(e.target.value)}>
    {TIME_SLOTS.map(t => (
      <option key={t} value={t} disabled={toMin(t) <= toMin(start) || toMin(t) < toMin('09:15')}>
        {t}
      </option>
    ))}
  </select>
  <small>09:15〜18:00まで選択可</small>
</label>
```

## サーバーサイドでの最終検証
- 送信時に `start < end` を必ずチェック（フロントは信用しない）。
- タイムゾーンは明示（例: `+09:00` 固定）し、DB 側で一貫して扱う。
- 競合（他予約との重複）はサーバーで再検証し、適切にエラー応答。

## i18n / 表記
- 24時間表記/秒の有無/ロケールに合わせた表示切替が必要なら、フォーマッタで統一。
- 日本語 UI の場合、先頭ゼロ/区切り（`:`）を揃える。

## テスト観点
- 境界: 09:00/09:15/17:45/18:00、連続変更、無効化→再有効化。
- アクセシビリティ: キーボード操作、スクリーンリーダー読み上げ、フォーカス遷移。
- サーバー: 同時更新衝突（保存時の二重送信/重複予約）。

---
必要に応じて、ポップオーバー（details/summary）版の実装指針や ARIA 設計も追記できます。
