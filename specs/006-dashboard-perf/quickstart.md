# Quickstart: 改修前後の測定と検証

## 目的

トップ初回表示が「直列合計 → 並列収束」したことと、表示数値にリグレッションがないことを確認する。

## 1. ベースライン（改修前）

すでに取得済み: 本番 HAR `geo-dojo.faru.jp.har`（2026-06-08）。
- 総ウォール ≒ 14.3秒 / Server Action 11本 / 並列重なり 0。

再取得する場合（Chrome DevTools）:
1. ログイン状態でトップを開く。
2. Network タブ → ページ再読込 → HAR をエクスポート。

HAR 解析（重なり検出）スニペット:

```js
// node -e でHARを読み、Server Action(POST /) の直列/並列を判定
const es = JSON.parse(require('fs').readFileSync(harPath,'utf8')).log.entries
  .filter(e => e.request.method === 'POST');
const start = Math.min(...es.map(e => +new Date(e.startedDateTime)));
const rows = es.map(e => ({ s: +new Date(e.startedDateTime)-start, t: e.time }))
  .sort((a,b)=>a.s-b.s);
let overlap = 0;
for (let i=1;i<rows.length;i++) if (rows[i].s < rows[i-1].s+rows[i-1].t-50) overlap++;
console.log('POST count', rows.length, 'overlapping pairs', overlap);
```

## 2. 期待結果（改修後）

- 初回表示で **直列の read Server Action 群が消える**（プリフェッチに統合）。
- ウォール時間が **< 3秒（目標 < 2秒）**。
- フィルタ変更時のみオンデマンド取得が走る。

## 3. リグレッション確認（数値一致）

改修前後で以下の主要指標が一致することを確認（目視またはテスト）:

- サマリ: `totalQuestions` / `totalCorrect` / `overallAccuracy` / `coverageRate`
- ストリーク: `currentStreak` / `longestStreak`
- 苦手ランキング上位（コード・errorRate）
- 復習: `dueCount` / `reviewingCount` / 今後7日の予定件数
- 推薦カードの提示内容（同一入力で同一推薦）

## 4. ローカル確認

```bash
pnpm dev          # supabase start + next dev
pnpm lint         # 型チェック / Lint
pnpm test         # 純粋関数の Vitest
```

read クエリを純粋関数化したら、集計ロジックは `pnpm test` で固定（テストデータは隔離投入）。
