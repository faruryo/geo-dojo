# Research & Decisions: 019-recommend-complete-loop

## 1. 明日の復習予定件数の算出ヘルパー

### Decision
純粋関数 `getTomorrowReviewCount` を `lib/quiz/srs/schedule-helper.ts` に定義する。
- 引数: `schedule: Array<{ date: string; count: number }>`, `now?: Date`
- 処理: JST での明日の日付文字列（`YYYY-MM-DD`）を求め、`schedule` 内から該当する日付の `count` を返す（見つからない場合は `0`）。

### Rationale
- JST の日付境界計算を pure 関数に閉じ込めることで、エッジケース（深夜帯、月末・年末跨ぎ等）を Vitest で決定論的に検証可能。
- `ReviewCard` や新規 `UpcomingReviewMini` など複数箇所で安全に再利用できる。

---

## 2. クエリキャッシュの最新化 (Cache Invalidation)

### Decision
クイズ完了画面の表示時（コンポーネントマウント時、または `phase === 'result'` 移行時）に `useQueryClient` を使って `['dashboard']` プレフィックスのクエリを `invalidateQueries` する。

### Rationale
- クイズ回答（`saveMunicipalityQuizResult`）によって DB の `srs_records` がリアルタイムに更新されるため、完了画面で即座に最新の明日の予定件数を表示する必要がある。
- `invalidateQueries` により、ユーザーがダッシュボードへ戻る前にバックグラウンドで最新データが取得され、スムーズな表示更新が実現する。

---

## 3. UI/UX 設計と 375px モバイルファースト

### Decision
`components/quiz/upcoming-review-mini.tsx` を新規作成する。
- 375px 幅のダークモード（`#111111` 背景、`bg-card`）に馴染むコンパクトなカード。
- 上部に「明日の復習予定: **XX** 件」をアイコン付きで視認性高く表示。
- 下部に今後7日間のミニバーグラフを配置。
- 「おすすめ経由」の場合、最上部に「✨ もう一度おすすめでプレイ」を目立つプライマリボタンとして配置。

### Rationale
- ユーザーの目的「明日の復習件数が多すぎないか（20件以内か）確認しながら連奏する」に最適化された情報密度と操作フローを提供する。
