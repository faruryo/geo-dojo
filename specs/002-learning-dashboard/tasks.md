# Tasks: 学習ダッシュボード

**Input**: Design documents from `specs/002-learning-dashboard/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/server-actions.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: 依存追加、ディレクトリ作成、ナビゲーション変更

- [x] T001 Recharts をインストール (`pnpm add recharts`)
- [x] T002 ダッシュボードコンポーネントディレクトリを作成 `components/dashboard/`
- [x] T003 ダッシュボード用 Server Actions ファイルを作成（空のエクスポート + 認証ヘルパー）`app/(app)/dashboard/actions.ts`
- [x] T004 ボトムナビにホームタブ（`/`）を追加。3タブ構成（ホーム / 都道府県 / 市区町村）に変更 `app/(app)/bottom-nav.tsx`
- [x] T005 ダッシュボードページのスケルトンを作成。空状態コンポーネントのみ表示 `app/(app)/page.tsx`
- [x] T006 ログイン後のリダイレクト先を `/quiz` → `/` に変更（認証関連ファイル）

**Checkpoint**: ログイン後に `/` が表示され、3タブのボトムナビが動作する

---

## Phase 2: Foundational

**Purpose**: 全USで共有するユーティリティとコンポーネント

- [x] T007 JST日付変換ヘルパー関数を作成（UTC→JST変換、日付境界計算）`lib/utils/date-jst.ts`
- [x] T008 [P] 空状態コンポーネントを作成（メッセージ + クイズ開始リンク）`components/dashboard/empty-state.tsx`

**Checkpoint**: ユーティリティとベースコンポーネントが利用可能

---

## Phase 3: User Story 1 - 学習サマリーカード (Priority: P1) 🎯 MVP

**Goal**: ダッシュボード上部に累計出題数・全体正答率・学習済み市区町村数・正解経験率を表示。前日比インジケーター付き。

**Independent Test**: `/` にアクセスし、サマリーカードに数値が表示される。クイズ履歴なしの場合は0表示+導線。

### Implementation for User Story 1

- [x] T009 [US1] `getDashboardSummary` Server Action を実装（累計統計 + 前日比算出）`app/(app)/dashboard/actions.ts`
- [x] T010 [US1] `useDashboardSummary` TanStack Query hook を作成 `lib/hooks/useDashboardSummary.ts`
- [x] T011 [US1] サマリーカードコンポーネントを作成（4カード + ↑↓→ インジケーター）`components/dashboard/summary-cards.tsx`
- [x] T012 [US1] ダッシュボードページにサマリーカードを組み込み `app/(app)/page.tsx`

**Checkpoint**: ダッシュボードに4つのサマリーカードが表示され、前日比インジケーターが動作する

---

## Phase 4: User Story 2 - 正答率の推移確認 (Priority: P2)

**Goal**: 日単位の正答率推移を折れ線グラフで表示。期間切替（7日/30日/全期間）、モードフィルター対応。

**Independent Test**: ダッシュボードに折れ線グラフが表示され、期間・モード切替が動作する。

### Implementation for User Story 2

- [x] T013 [US2] `getAccuracyTrend` Server Action を実装（日別集計 + 全期間90日超は週次集約）`app/(app)/dashboard/actions.ts`
- [x] T014 [US2] `useAccuracyTrend` TanStack Query hook を作成 `lib/hooks/useAccuracyTrend.ts`
- [x] T015 [US2] 正答率推移グラフコンポーネントを作成（Recharts LineChart + 期間切替 + モードフィルター + ツールチップ）`components/dashboard/accuracy-chart.tsx`
- [x] T016 [US2] ダッシュボードページにグラフを組み込み `app/(app)/page.tsx`

**Checkpoint**: 折れ線グラフが表示され、7日/30日/全期間の切替とモードフィルターが動作する

---

## Phase 5: User Story 3 - 苦手市区町村ランキング (Priority: P3)

**Goal**: 不正解率トップ20の市区町村をランキング表示。各エントリから苦手優先クイズへ遷移可能。

**Independent Test**: ダッシュボードに苦手ランキングが表示され、タップでクイズに遷移できる。

### Implementation for User Story 3

- [x] T017 [US3] `getWeaknessRanking` Server Action を実装（既存 getMunicipalityWeakness を拡張、totalCount/errorCount 追加）`app/(app)/dashboard/actions.ts`
- [x] T018 [US3] `useWeaknessRanking` TanStack Query hook を作成 `lib/hooks/useWeaknessRanking.ts`
- [x] T019 [US3] 苦手ランキングコンポーネントを作成（リスト + 正答率バー + クイズ遷移リンク）`components/dashboard/weakness-ranking.tsx`
- [x] T020 [US3] ダッシュボードページにランキングを組み込み `app/(app)/page.tsx`

**Checkpoint**: 苦手ランキングが表示され、タップで苦手優先クイズが開始できる

---

## Phase 6: User Story 4 - 連続学習日数 / ストリーク (Priority: P4)

**Goal**: 現在のストリーク日数・最長ストリーク・今日の学習状況を表示。

**Independent Test**: ダッシュボードにストリーク日数が表示され、今日の実施状況が分かる。

### Implementation for User Story 4

- [x] T021 [US4] `getStreak` Server Action を実装（JST日付でDISTINCT集計 → 連続日数計算）`app/(app)/dashboard/actions.ts`
- [x] T022 [US4] `useStreak` TanStack Query hook を作成 `lib/hooks/useStreak.ts`
- [x] T023 [US4] ストリーク表示コンポーネントを作成（現在/最長ストリーク + 今日の状況）`components/dashboard/streak-display.tsx`
- [x] T024 [US4] ダッシュボードページにストリークを組み込み `app/(app)/page.tsx`

**Checkpoint**: ストリーク日数が表示され、今日の学習状況が確認できる

---

## Phase 7: User Story 5 - 全市区町村コンプリート率 (Priority: P5)

**Goal**: 全市区町村（約1,900件）の正解経験率をプログレスバーで表示。残数と全制覇メッセージ。

**Independent Test**: ダッシュボードにプログレスバーが表示され、正解済み件数/全件数/残数が確認できる。

### Implementation for User Story 5

- [x] T025 [US5] コンプリート率プログレスバーコンポーネントを作成（バー + 件数表示 + 全制覇メッセージ）`components/dashboard/completion-progress.tsx`
- [x] T026 [US5] ダッシュボードページにプログレスバーを組み込み（`useDashboardSummary` のデータを再利用）`app/(app)/page.tsx`

**Checkpoint**: コンプリート率のプログレスバーと残数が表示される

---

## Phase 8: User Story 6 - 難易度別の制覇進捗 (Priority: P6)

**Goal**: ☆〜☆☆☆☆の4段階ごとの正解経験率を4本のプログレスバーで表示。

**Independent Test**: ダッシュボードに4本の難易度別プログレスバーが表示される。

### Implementation for User Story 6

- [x] T027 [US6] `getDifficultyProgress` Server Action を実装（municipality_master JOIN + difficulty GROUP BY）`app/(app)/dashboard/actions.ts`
- [x] T028 [US6] `useDifficultyProgress` TanStack Query hook を作成 `lib/hooks/useDifficultyProgress.ts`
- [x] T029 [US6] 難易度別プログレスバーコンポーネントを作成（4バー + 件数 + 制覇表示）`components/dashboard/difficulty-progress.tsx`
- [x] T030 [US6] ダッシュボードページに難易度別進捗を組み込み `app/(app)/page.tsx`

**Checkpoint**: 4段階の難易度別プログレスバーが表示される

---

## Phase 9: User Story 7 - 復習おすすめリスト (Priority: P7)

**Goal**: 不正解歴あり＋最終出題から7日以上経過の市区町村を上位10件表示。復習クイズへの遷移。

**Independent Test**: ダッシュボードに復習おすすめリストが表示され、復習クイズを開始できる。

### Implementation for User Story 7

- [x] T031 [US7] `getReviewRecommendations` Server Action を実装（不正解＋7日以上経過フィルター）`app/(app)/dashboard/actions.ts`
- [x] T032 [US7] `useReviewRecommendations` TanStack Query hook を作成 `lib/hooks/useReviewRecommendations.ts`
- [x] T033 [US7] 復習おすすめコンポーネントを作成（リスト + 復習クイズ開始ボタン）`components/dashboard/review-recommendations.tsx`
- [x] T034 [US7] ダッシュボードページに復習おすすめを組み込み `app/(app)/page.tsx`

**Checkpoint**: 復習おすすめリストが表示され、復習クイズに遷移できる

---

## Phase 10: User Story 8 - 今週のベスト記録 (Priority: P8)

**Goal**: 今週の最高正答率セッションを表示。全期間自己ベスト一致時はハイライト。

**Independent Test**: ダッシュボードに今週のベスト記録が表示される。

### Implementation for User Story 8

- [x] T035 [US8] `getRecentSessions` Server Action を実装（セッション推定: 同一モード・5分ギャップでグルーピング、LAGウィンドウ関数）`app/(app)/dashboard/actions.ts`
- [x] T036 [US8] `useRecentSessions` TanStack Query hook を作成 `lib/hooks/useRecentSessions.ts`
- [x] T037 [US8] 今週のベスト記録コンポーネントを作成（最高正答率 + モード + 日付 + 自己ベストハイライト）`components/dashboard/weekly-best.tsx`
- [x] T038 [US8] ダッシュボードページに今週のベストを組み込み `app/(app)/page.tsx`

**Checkpoint**: 今週のベスト記録が表示され、自己ベスト時にハイライトされる

---

## Phase 11: User Story 9 - 前回セッションとの比較 (Priority: P9)

**Goal**: 直近セッションと前回セッションの正答率差分を表示。

**Independent Test**: ダッシュボードに前回比較の差分（+○%改善 等）が表示される。

### Implementation for User Story 9

- [x] T039 [US9] 前回比較コンポーネントを作成（差分表示 + ポジティブ/励ましメッセージ）`components/dashboard/session-comparison.tsx`
- [x] T040 [US9] ダッシュボードページに前回比較を組み込み（`useRecentSessions` のデータを再利用）`app/(app)/page.tsx`

**Checkpoint**: 前回比較が表示され、改善/低下に応じたメッセージが出る

---

## Phase 12: User Story 10 - マイルストーン通知 (Priority: P10)

**Goal**: 累計正解数/正解経験率の閾値超えでバナー表示。閉じた状態をローカルストレージで管理。

**Independent Test**: 閾値を超えた状態でダッシュボードを開くとバナーが表示され、閉じると再表示されない。

### Implementation for User Story 10

- [x] T041 [US10] マイルストーンバナーコンポーネントを作成（閾値判定 + localStorage既読管理 + 閉じるボタン）`components/dashboard/milestone-banner.tsx`
- [x] T042 [US10] ダッシュボードページにマイルストーンバナーを組み込み（`useDashboardSummary` のデータで閾値判定）`app/(app)/page.tsx`

**Checkpoint**: マイルストーン閾値超過でバナーが表示され、閉じると再表示されない

---

## Phase 13: Polish & Cross-Cutting Concerns

**Purpose**: 全体的なUI調整、レスポンシブ対応、パフォーマンス確認

- [x] T043 ダッシュボードのセクション順序とレイアウトを調整（モバイル375px確認、横スクロールなし）`app/(app)/page.tsx`
- [x] T044 [P] Recharts のダークモードカラーパレットを調整（背景 #111111 対応）`components/dashboard/accuracy-chart.tsx`
- [x] T045 [P] ダッシュボード全セクションのローディング状態を追加（Skeleton UI）`app/(app)/page.tsx`
- [ ] T046 quickstart.md の手順に従って動作確認を実施 `specs/002-learning-dashboard/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies - 即開始可能
- **Phase 2 (Foundational)**: Phase 1 完了後
- **Phase 3-12 (User Stories)**: Phase 2 完了後に着手可能
  - 各USは独立して実装可能だが、優先順に実施を推奨
- **Phase 13 (Polish)**: 全USまたは希望するUSの完了後

### User Story Dependencies

- **US1 (サマリーカード)**: Phase 2 完了後に着手可能。他USへの依存なし
- **US2 (推移グラフ)**: Phase 2 完了後。US1 と独立
- **US3 (苦手ランキング)**: Phase 2 完了後。US1 と独立
- **US4 (ストリーク)**: Phase 2 完了後。US1 と独立
- **US5 (コンプリート率)**: **US1 に依存**（`useDashboardSummary` のデータを再利用）
- **US6 (難易度別進捗)**: Phase 2 完了後。US1 と独立
- **US7 (復習おすすめ)**: Phase 2 完了後。US1 と独立
- **US8 (今週のベスト)**: Phase 2 完了後。US1 と独立
- **US9 (前回比較)**: **US8 に依存**（`useRecentSessions` のデータを再利用）
- **US10 (マイルストーン)**: **US1 に依存**（`useDashboardSummary` のデータで閾値判定）

### Within Each User Story

- Server Action → TanStack Query Hook → UI Component → ページ組み込み

### Parallel Opportunities

- **Phase 1**: T001〜T006 は順次実行（依存あり）
- **Phase 2**: T007, T008 は並列実行可能 [P]
- **US間**: US1 完了後、US2/US3/US4/US5/US6/US7/US8 は並列着手可能
- **US内**: Server Action と Hook は順次、異なるUSの Server Actions は並列可能

---

## Parallel Example: Phase 3-6

```bash
# US1 完了後、以下を並列で着手可能:
Task: "T013 [US2] getAccuracyTrend Server Action"
Task: "T017 [US3] getWeaknessRanking Server Action"
Task: "T021 [US4] getStreak Server Action"
Task: "T027 [US6] getDifficultyProgress Server Action"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup（Recharts追加、ナビ変更、スケルトン）
2. Phase 2: Foundational（日付ヘルパー、空状態）
3. Phase 3: US1 サマリーカード
4. **STOP and VALIDATE**: `/` にサマリーカードが表示されることを確認
5. デプロイ可能な最小ダッシュボード

### Incremental Delivery

1. Setup + Foundational → 空のダッシュボードページ
2. US1 サマリーカード → MVP デプロイ
3. US2 推移グラフ → 視覚的なインパクト追加
4. US3 苦手ランキング → アクション導線追加
5. US4 ストリーク → ゲーミフィケーション追加
6. US5-US6 プログレスバー → 制覇進捗追加
7. US7 復習おすすめ → 学習効率化
8. US8-US9 セッション比較 → 短期モチベーション
9. US10 マイルストーン → 達成感演出
10. Polish → 最終調整

---

## Notes

- [P] tasks = 異なるファイル、依存なし
- [Story] label は spec.md のユーザーストーリーに対応
- 各USは独立して完了・テスト可能（US5→US1, US9→US8, US10→US1 の依存のみ注意）
- Server Actions は全て `app/(app)/dashboard/actions.ts` に集約
- 全集計はクエリ時算出、新テーブル不要
- Recharts のダークモード対応は Phase 13 で一括調整
