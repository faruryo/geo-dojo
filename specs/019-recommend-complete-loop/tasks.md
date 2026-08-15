# Tasks: クイズ完了画面での復習予定表示と即時おすすめPlay導線 (B019)

**Feature Branch**: `019-recommend-complete-loop` | **Date**: 2026-08-15 | **Plan**: [plan.md](file:///Users/faru/geo-dojo/specs/019-recommend-complete-loop/plan.md)

## Task Summary

- Total Tasks: 9
- Foundational: 2 tasks
- User Story 1 (復習予定表示): 3 tasks
- User Story 2 (即時おすすめPlay導線): 2 tasks
- Polish & Verification: 2 tasks

---

## Phase 1: Foundational

- [x] T001 [P] `getTomorrowReviewCount` の単体テスト作成（JST明日判定、該当あり/なし、空/nullデータ） in `__tests__/lib/quiz/srs/schedule-helper.test.ts`
- [x] T002 `getTomorrowReviewCount` 純粋関数の実装 in `lib/quiz/srs/schedule-helper.ts`

---

## Phase 2: User Story 1 - クイズ完了画面での復習予定（明日の件数）の確認 (Priority: P1)

**Goal**: クイズ終了直後に、最新の明日の復習予定件数と7日間のミニスケジュールが表示される。

- [x] T003 [P] [US1] 復習予定ミニカードコンポーネント `UpcomingReviewMini` の実装（明日の件数バッジ + 7日間ミニグラフ + ローディング骨格） in `components/quiz/upcoming-review-mini.tsx`
- [x] T004 [US1] 市区町村クイズ完了画面（`app/(app)/quiz/municipality/[mode]/page.tsx`）に `UpcomingReviewMini` を配置し、結果画面表示時に `['dashboard']` クエリを invalidate する
- [x] T005 [US1] 復習クイズ完了画面（`app/(app)/quiz/review/page.tsx`）に `UpcomingReviewMini` を配置し、結果画面表示時に `['dashboard']` クエリを invalidate する

---

## Phase 3: User Story 2 - 完了画面からの即時おすすめリプレイ導線 (Priority: P1)

**Goal**: おすすめクイズ完了画面から、ワンタップで即座におすすめクイズの再プレイを開始できる。

- [x] T006 [US2] `RecommendReplayButton` のスタイルとアイコンを最適化しプライマリアクションとして機能させる in `components/recommend/recommend-replay-button.tsx`
- [x] T007 [US2] 市区町村クイズ完了画面において、おすすめ経由時（`isRecommendSource`）に `RecommendReplayButton` をアクション領域の最上部に配置する in `app/(app)/quiz/municipality/[mode]/page.tsx`

---

## Phase 4: Polish & Validation

- [x] T008 全体テスト (`pnpm test`)、型チェック (`npx tsc --noEmit`)、Lint Ratchet (`pnpm lint:ratchet`) を実行し全パスを確認
- [x] T009 `specs/backlog.md` の B019 ステータスを更新
