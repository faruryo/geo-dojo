---
description: "Task list for 市区町村クイズの問題に難易度を表示"
---

# Tasks: 市区町村クイズの問題に難易度を表示

**Input**: Design documents from `/specs/008-quiz-difficulty-display/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/difficulty-badge.md, quickstart.md

**Tests**: 純粋関数 `representativeDifficulty()` の単体テストのみ含む（research.md Decision 5 / プロジェクト方針）。UI 描画はコンポーネントテスト基盤がないため手動確認。

**Organization**: タスクはユーザーストーリー単位。US1（P1, MVP）と US2（P2）は共通の `QuizRunner` を変更するが、別レンダリング分岐（BCD / A）と検証対象が異なるため、独立して実装・検証可能。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 別ファイル・依存なしで並行実行可能
- **[Story]**: US1 / US2（該当フェーズのみ）

## Path Conventions

Next.js 単一プロジェクト（App Router）。ロジックは `lib/quiz/`、UI は `components/quiz/`、テストは `__tests__/lib/quiz/`。

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 再利用資産の確認（新規依存なし）

- [X] T001 既存資産の再利用可否を確認: `components/ui/badge`（`Badge`）と `lib/quiz/municipality-data.ts` の `Difficulty` / `DIFFICULTIES` / `DIFFICULTY_LABEL` が存在し import 可能であること（新規パッケージ追加は不要）

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 両ストーリーが使う代表難易度ロジック。UI 着手前に完了必須。

**⚠️ CRITICAL**: T002 完了まで US1 / US2 のレンダリング実装は開始しない

- [X] T002 `lib/quiz/municipality-data.ts` に純粋関数 `representativeDifficulty(municipalities: Municipality[]): Difficulty | undefined` を追加。仕様: `difficulty === undefined` の要素は無視し、残りのうち `DIFFICULTIES.indexOf()` が最大（最難）の難易度を返す。全要素が undefined / 空配列なら `undefined`（data-model.md 準拠、FR-005 / FR-007）
- [X] T003 `__tests__/lib/quiz/representative-difficulty.test.ts` を新規作成し Vitest で検証: ①単一→その難易度 ②混在（例 easy+hard+medium）→`hard` ③一部 undefined を含む→残りの最難 ④全 undefined→`undefined` ⑤空配列→`undefined`。`pnpm test` で通すこと（T002 に依存）

**Checkpoint**: 代表難易度ロジックが確定・テスト済み。UI 実装を開始できる。

---

## Phase 3: User Story 1 - 出題中に難易度がわかる (Priority: P1) 🎯 MVP

**Goal**: モードB/C/D の出題中、各問題カードに難易度バッジを表示し、問題遷移で更新、フィードバック中も保持する。

**Independent Test**: `/quiz/municipality/B`（および C・D）で出題開始し、問題カードに難易度バッジが出る／次問で更新される／解答直後のフィードバック中も消えないことを確認。

### Implementation for User Story 1

- [X] T004 [US1] `components/quiz/quiz-runner.tsx` の BCD 分岐（`currentQuestion.kind === 'BCD'`）で、`representativeDifficulty([currentQuestion.municipality])` から表示用難易度を導出する（`currentQuestion` 由来のためフィードバック中も保持＝契約 C-03）
- [X] T005 [US1] `components/quiz/quiz-runner.tsx` の BCD 問題カード（`rounded-xl bg-card ...` ブロック）内、問題文近傍に `<Badge variant="secondary">{DIFFICULTY_LABEL[difficulty]}</Badge>` を描画。導出値が `undefined` のときはバッジ自体を描画しない（C-04）。進捗ヘッダー・残り秒数バーと別ブロックに置き重ねない（C-05 / C-06）
- [X] T006 [US1] `pnpm dev` で手動確認: モードB/C/D で出題時にバッジ表示、次問で更新、フィードバック中も保持、375px・ダークモードでレイアウト崩れなし（quickstart.md 手順 1〜3, 5）

**Checkpoint**: モードB/C/D で難易度表示が独立して機能する（MVP として出荷可能）。

---

## Phase 4: User Story 2 - すべての出題モードで一貫して見える (Priority: P2)

**Goal**: モードA（地図逆引き）にも難易度バッジを拡張し、複数対象時は最難を表示。全モード＋復習クイズで一貫表示を担保する。

**Independent Test**: `/quiz/municipality/A` で出題し、同名複数県の問題で最難の難易度が表示されることを確認。`/quiz/review` でも通常クイズと同じ要領でバッジが出ることを確認。

### Implementation for User Story 2

- [X] T007 [US2] `components/quiz/quiz-runner.tsx` のモードA 分岐（`currentQuestion.kind === 'A'`）で、`representativeDifficulty(currentQuestion.instances)` から表示用難易度を導出する（複数対象→最難＝FR-007）
- [X] T008 [US2] `components/quiz/quiz-runner.tsx` のモードA 問題カード内に、US1 と同一の体裁・位置でバッジを描画。`undefined` 時は非表示（C-04）。BCD と表記/配置を揃える（FR-002 / FR-004）
- [X] T009 [US2] `pnpm dev` で手動確認: モードA（同名複数県の問題で最難表示）と復習クイズ `/quiz/review` でバッジが一貫表示される（quickstart.md 手順 4、及び A の混在ケース）

**Checkpoint**: 全モード（A/B/C/D）＋復習クイズで難易度表示が一貫する。

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: 重複排除・最終検証

- [X] T010 `components/quiz/quiz-runner.tsx` の A 分岐と BCD 分岐で重複するバッジ描画を、ローカルの共有スニペット（小コンポーネント or 変数）へ抽出して重複を解消（任意・挙動不変）
- [X] T011 [P] `pnpm lint` を実行し型チェック / Lint をパスさせる
- [X] T012 quickstart.md の検証チェックリスト（手順 1〜5）と spec の受け入れシナリオ（US1/US2）を最終確認

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 依存なし
- **Foundational (Phase 2)**: Setup 後。T003 は T002 に依存。**US1/US2 の UI をブロック**
- **US1 (Phase 3)**: Foundational 完了後に開始可能
- **US2 (Phase 4)**: Foundational 完了後に開始可能。US1 とは独立に検証可能（同一ファイルの別分岐を編集するため、同時編集の競合のみ注意）
- **Polish (Phase 5)**: US1・US2 完了後

### User Story Dependencies

- **US1 (P1)**: T002 完了後に着手可。他ストーリー非依存
- **US2 (P2)**: T002 完了後に着手可。US1 とロジックを共有するが独立にテスト可能

### Within Each User Story

- 導出ロジック（T004 / T007）→ 描画（T005 / T008）→ 手動検証（T006 / T009）

### Parallel Opportunities

- T002 と T003 は同一ファイル/依存関係のため逐次（[P] なし）
- US1（T004–T006）と US2（T007–T009）はどちらも `quiz-runner.tsx` を編集するため**並行編集は非推奨**（逐次 or ブランチ分離）。[P] は付けない
- T011（lint）は他の検証と独立して実行可

---

## Implementation Strategy

### MVP First (User Story 1 のみ)

1. Phase 1: Setup（T001）
2. Phase 2: Foundational（T002–T003）— 全体をブロック
3. Phase 3: US1（T004–T006）
4. **STOP & VALIDATE**: モードB/C/D で難易度表示を独立検証 → デモ可能

### Incremental Delivery

1. Setup + Foundational → 基盤完成
2. US1 追加 → B/C/D で検証 → デモ（MVP）
3. US2 追加 → モードA + 復習で検証 → デモ
4. Polish（重複排除・lint・最終確認）

---

## Notes

- 本機能は表示のみ。DB スキーマ・Server Action・API・外部通信の追加なし（Constitution Check 済み）。
- 市区町村クイズと復習クイズは共通 `QuizRunner` を使うため、US2 の検証で復習側も自動的にカバーされる。
- [P] = 別ファイル・依存なし。US1/US2 は同一ファイルを触るため [P] を付与していない。
- 各タスク完了ごと、または論理的なまとまりでコミット推奨。
