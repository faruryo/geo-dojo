# Tasks: 詳細分析ページ (025-detailed-analytics)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 共通のデータ取得・プリフェッチ基盤の準備

- [ ] T001 プリフェッチ関数 `getAnalyticsDehydratedState` を `lib/analytics/prefetch.ts` に実装

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 画面アクセスと共通ナビゲーションの整備

**⚠️ CRITICAL**: 画面遷移基盤を整えてから各ユーザーストーリーのUI実装を進める

- [ ] T002 [P] [US3] ボトムナビゲーション `app/(app)/bottom-nav.tsx` に「分析」（`/analytics`、`BarChart2` アイコン）を追加

**Checkpoint**: ナビゲーションから `/analytics` への導線が確立

---

## Phase 3: User Story 1 - 学習データの詳細内訳を見る (Priority: P1) 🎯 MVP

**Goal**: 詳細分析画面で、4サマリーカード（出題数・正答率・A制覇・D制覇）、推移グラフ、モード・難易度別クリア状況、苦手市区町村ランキングを縦スクロールで閲覧可能にする

**Independent Test**: クイズ回答履歴を持つユーザーで `/analytics` を開き、全データが正しく描画され、未プレイユーザーでは EmptyState が表示されることを確認する

### Tests for User Story 1 ⚠️

- [ ] T003 [P] [US1] 詳細分析画面の描画・EmptyStateテストを `__tests__/components/analytics/analytics-client.test.tsx` に作成

### Implementation for User Story 1

- [ ] T004 [US1] 4サマリーカード（出題数・正答率・A制覇・D制覇）対応の `SummaryCards` を含む詳細分析クライアントコンポーネント `components/analytics/analytics-client.tsx` を作成
- [ ] T005 [US1] 詳細分析 Server Component `app/(app)/analytics/page.tsx` を作成し、プリフェッチと `HydrationBoundary` でクライアントをマウント

**Checkpoint**: User Story 1 単体で詳細分析画面の全データ閲覧が機能する (MVP)

---

## Phase 4: User Story 2 - 条件（期間・地方・モード）を絞り込んで分析する (Priority: P2)

**Goal**: 期間（7日/30日/全期間）や地方・モード（全て/県当て/県当て練習/市当て練習/場所当て）を切り替えて、特定スコープに絞った推移グラフや苦手ランキングを動的に更新する

**Independent Test**: フィルター操作時にグラフと苦手ランキングが即座に連動して絞り込まれることを確認する

### Tests for User Story 2 ⚠️

- [ ] T006 [P] [US2] フィルター変更時のクエリ・苦手ランキング絞り込み連動テストを `__tests__/components/analytics/analytics-filter.test.tsx` に作成

### Implementation for User Story 2

- [ ] T007 [US2] `components/analytics/analytics-client.tsx` 内で `FilterBar` の選択状態（期間・地方・モード）を `AccuracyChart`, `WeaknessRanking`, `DifficultyProgress` にバインドして動的連動を実装（024モード表記対応）

**Checkpoint**: 絞り込みフィルターによる動的なデータ分析・苦手ランキング絞り込みが機能する

---

## Phase 5: User Story 3 - ナビゲーションからスムーズに詳細分析画面へ移動する (Priority: P1)

**Goal**: ボトムナビゲーションから迷わず `/analytics` と `/` を行き来できる

**Independent Test**: ボトムナビの「分析」タブのタップで遷移し、アクティブ状態（ハイライト）が正しく切り替わることを確認する

### Tests for User Story 3 ⚠️

- [ ] T008 [P] [US3] ボトムナビゲーションの遷移とアクティブ状態のテストを `__tests__/components/analytics/bottom-nav-analytics.test.tsx` に作成

### Implementation for User Story 3

- [ ] T009 [US3] `app/(app)/bottom-nav.tsx` のアクティブ判定および `/analytics` 画面のレイアウト（パディング・セーフエリア）の統合確認

**Checkpoint**: ナビゲーションによる画面遷移とハイライトが完全動作する

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: モバイル表示最適化、コード品質・型検査、回帰テスト確認

- [ ] T010 [P] 375px幅モバイル表示でのマージン・スクロール・ダークモードのUI調整
- [ ] T011 `pnpm type-check`, `pnpm lint`, `pnpm test` を実行し、全テスト通過とlint/型エラーゼロを確認

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 依存なし。即時開始可能。
- **Foundational (Phase 2)**: Setup完了後に開始。
- **User Story 1 (Phase 3)**: Foundational完了後に開始（MVP）。
- **User Story 2 (Phase 4)**: US1のコンポーネント作成後に連動実装。
- **User Story 3 (Phase 5)**: Foundational/US1完了後に統合検証。
- **Polish (Phase 6)**: 全ストーリー完了後に実行。

---

## Parallel Opportunities

- T002, T003, T006, T008 のテスト・ナビ定義は並列着手可能。
- T010 のレスポンシブ微調整はコンポーネント実装と並行して確認可能。
