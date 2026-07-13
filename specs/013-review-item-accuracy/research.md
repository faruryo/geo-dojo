# Research: 復習項目一覧の正答率表示

本ドキュメントでは、「復習項目一覧の正答率表示」機能を実現するための設計上の決定事項と技術的調査結果をまとめる。

## 調査した課題

1. **正答率の集計元と結合キー**
   - `getReviewItemList`（`app/(app)/dashboard/actions.ts:102-147`）は `srsRecords` から `municipalityName`/`mode`/`dueDate`/`repetition`/`interval` のみを SELECT しており、正答率算出に必要な `municipalityCode`（`municipality_quiz_results` との結合キー）を返していない。
2. **既存の集計パターンの有無**
   - ダッシュボードの「苦手ランキング」機能（`getWeaknessRankingData`, `app/(app)/dashboard/queries.ts:516-547`）が、まさに同じ `municipality_quiz_results` から `municipalityCode + mode` 単位で正解率相当の値（`errorRate`）を集計する SQL パターンを既に持っている。
3. **N+1 を避けたページ単位の集計方法**
   - 一覧はページング表示（1ページ最大25件）のため、行ごとに正答率クエリを発行すると N+1 になる。1ページ分をまとめて1回のクエリで集計する必要がある。
4. **正答率取得失敗時のフォールバック**
   - FR-006 により、正答率の取得に失敗しても一覧本体（種目バッジ・次回期日）の表示をブロックしてはならない。既存の `getReviewItemList` は `rows`/`totalRow` を `Promise.all` でまとめて取得しているため、正答率取得を同じ `Promise.all` に混ぜると一方の失敗が全体を失敗させてしまう。

---

## Technical Decisions

### Decision 1: 正答率集計は `getWeaknessRankingData` と同じ SQL パターンを再利用する

- **決定内容**: `app/(app)/dashboard/queries.ts` に `getItemAccuracyData(userId: string, pairs: { municipalityCode: string; mode: string }[])` を新設する。`municipality_quiz_results` を `userId` と `municipalityCode IN (...)`（`inArray`）で絞り込み、`municipalityCode, mode` で `GROUP BY` し、`COUNT(*)` と `SUM(CASE WHEN isCorrect THEN 1 ELSE 0 END)` を集計する。
- **理由**: `getWeaknessRankingData` が既に同一テーブル・同一粒度（市区町村×モード）で正解/不正解の集計を行っており、車輪の再発明を避けられる。集計方式（全解答試行に対する割合）を機能間で統一することで、「苦手ランキング」と「正答率表示」の数値が矛盾しない。
- **範囲**: `getWeaknessRankingData` は不正解率降順・`HAVING errorCount > 0` のランキング用途に特化しているため関数自体は流用せず、同じ SQL パターンを踏まえた別関数として新設する（用途・戻り値の形が異なるため）。

### Decision 2: `municipalityCode` を `getReviewItemList` の SELECT に追加する

- **決定内容**: `srsRecords` からの SELECT に `municipalityCode` を追加し、`getItemAccuracyData` の呼び出しキー（`{ municipalityCode, mode }[]`）として現在ページの行から組み立てる。
- **理由**: 正答率集計には結合キーが必須。既存の戻り値フィールド（`municipalityName` 等）はそのまま維持し、追加のみを行うため後方互換性がある。

### Decision 3: 正答率集計の失敗を一覧本体の取得から分離する

- **決定内容**: `getReviewItemList` 内で、SRS一覧取得（`rows`/`totalRow` の `Promise.all`）とは別に、`getItemAccuracyData` を独立した `try/catch`（または `.catch()` でフォールバック値を返す）で呼び出す。失敗時は全項目の `accuracy` を `undefined` として返し、エラーを再スローしない。
- **理由**: FR-006 は「正答率取得の失敗が一覧全体の表示をブロックしてはならない」ことを明示的に要求している。1つの `Promise.all` にまとめると Drizzle 側のエラー（例: 一時的な接続断）が一覧本体まで巻き込んで失敗させてしまう。関心事を分離することで、正答率だけが欠けた状態でも一覧が表示され続ける。

### Decision 4: 低正答率の視覚的区別は既存の色分けクラスで表現し、新規コンポーネントは作らない

- **決定内容**: `app/(app)/quiz/review/items/page.tsx` のモード別サマリ表で既に使われている色分けパターン（96行目 `text-green-500`）に倣い、正答率が50%未満の項目には `text-destructive`（shadcn/ui の既存トークン）を条件付きで適用する。新規バッジ・新規コンポーネントは追加しない。
- **理由**: 008-quiz-difficulty-display の契約（`difficulty-badge.md`）でも「既存 shadcn/ui コンポーネントの流用、独自文字列/独自コンポーネントを増やさない」方針が踏襲されている。本機能もこの慣習に合わせる。閾値（50%）は仕様上「視覚的に区別できること」のみが要件（FR-007）であり、実装時の裁量として妥当な値を選んだ。

---

## Alternatives Considered

### Alternative A: 行ごとに正答率を個別クエリで取得する（N+1）

- **不採用理由**: 1ページ最大25件のたびに25回のクエリが発行され、既存の「1リクエスト=1〜2クエリ」という性能特性を大きく悪化させる。憲法原則 II（アーキテクチャ&パフォーマンス）に反する。

### Alternative B: `srsRecords` 自体に正答率カラム（累積正解数・累積試行数）を持たせる

- **不採用理由**: スキーマ変更（新規カラム・マイグレーション）が必要になり、既存の `municipality_quiz_results` という正となるデータソースと二重管理になる。既存データからの集計で要件を満たせるため、スキーマ変更のコストに見合わない（Assumptions: 既存の苦手ランキングと同じ集計範囲を踏襲する方針とも整合しない）。

### Alternative C: 正答率取得も一覧取得と同じ `Promise.all` にまとめる

- **不採用理由**: Decision 3 の通り、FR-006（失敗時のブロック禁止）を満たせない。一方の失敗が他方まで巻き込んでしまう。
