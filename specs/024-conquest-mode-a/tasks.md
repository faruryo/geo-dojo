---
description: "Task list for 024-conquest-mode-a"
---

# Tasks: 制覇は県当て地図と場所当て地図、おすすめはA/D抽選

**Input**: Design documents from `/specs/024-conquest-mode-a/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: 動作変更のため必須。新規回帰テストは実装前に赤になることを確認してから実装する。

**Organization**: User story 単位。US1 が MVP（A/D バー＋D のコード単位）。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 別ファイルで並列可
- **[Story]**: US1–US4（Setup / Foundational / Polish には付けない）

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 設計どおりの置き場を用意する。新規パッケージは不要。

- [ ] T001 Add placeholder modules `lib/quiz/location-labels.ts` and `lib/quiz/recommendation/coverage-cells.ts` per `specs/024-conquest-mode-a/plan.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: D のコード単位 identity と区付きラベル。US1 のバー・未クリア・地図の前提。

**⚠️ CRITICAL**: このフェーズ完了まで US 実装を始めない

- [ ] T002 Write failing tests for D identity (code unit, no (name, prefecture) fold) and B/C unchanged aggregation in `__tests__/lib/quiz/sampling.test.ts`
- [ ] T003 Split `IdentityCodeMap` so Mode D uses municipality codes while B/C keep `(prefecture, normalizedName)` in `lib/quiz/sampling.ts` and `lib/quiz/municipality-questions.ts`
- [ ] T004 [P] Write failing tests for designated-city ward labels (Sapporo wards distinguishable; Tokyo 23 wards keep 区名) in `__tests__/lib/quiz/location-labels.test.ts`
- [ ] T005 [P] Add build-time code→区付きラベル map and `locationLabel(code)` in `lib/quiz/location-labels.ts` plus `lib/quiz/data/designated-city-ward-names.json` (do not change `municipality_master.name`)

**Checkpoint**: D の未クリア判定と区ラベルをテストで固定できる

---

## Phase 3: User Story 1 - 全国制覇は県当てと場所当てを別々に見る (Priority: P1) 🎯 MVP

**Goal**: トップは A バーと D バーのみ。B/C はどちらも進めない。D は政令市区をコード単位で制覇・正誤・タップする。

**Independent Test**: A のみ正解で A だけ増える。D のみで D だけ。B/C のみで両バー不変。合算%なし。政令市一区の D 正解で他区は未クリア。別区タップは不正解。回答前に区が分かる。出題区の地図が選べる。

### Tests for User Story 1

- [ ] T006 [P] [US1] Write failing tests that Mode D tap correctness uses `code === municipality.code` (same city other ward is wrong) in `__tests__/components/quiz/use-quiz-actions-mode-d.test.ts` (or extend nearest existing quiz-action test)
- [ ] T007 [P] [US1] Write failing tests that MunicipalityMap merges only same `code` polygons, not same `nam_ja` in `__tests__/components/map/municipality-map-merge.test.ts` (or extend `__tests__/components/map/autofocus-integration.test.tsx`)

### Implementation for User Story 1

- [ ] T008 [US1] Change Mode D judging and highlight codes to the question code only in `components/quiz/use-quiz-actions.ts`
- [ ] T009 [US1] Stop union-by-`nam_ja`; merge only duplicate geometries of the same `code` in `components/map/MunicipalityMap.tsx`
- [ ] T010 [US1] Show `locationLabel` on Mode D prompt and feedback in `components/quiz/quiz-runner.tsx` (and any Mode D question header in `app/(app)/quiz/municipality/[mode]/page.tsx`)
- [ ] T011 [US1] Replace dashboard combined conquest with two fixed bars (A nationwide including Hokkaido; D by code) and remove combined % in `components/dashboard/dashboard-client.tsx`, `components/dashboard/completion-progress.tsx`, `components/dashboard/summary-cards.tsx`, `components/dashboard/milestone-banner.tsx`

**Checkpoint**: US1 をトップと D クイズだけで確認できる（おすすめ・モード文言・分析削除は後続）

---

## Phase 4: User Story 2 - モードの呼び方が役割と一致する (Priority: P1)

**Goal**: モード選択で A 県当て地図、B/C 練習4択、D 場所当て地図と読める。URL の A/B/C/D は変えない。

**Independent Test**: `/quiz/municipality` の4カードに短い日本語があり、B と C が練習と分かる。

### Tests for User Story 2

- [ ] T012 [US2] Add or extend a test that mode catalog copy matches 県当て/練習/場所当て in `__tests__/lib/quiz/last-selected-mode.test.ts` or a small `__tests__/app/municipality-mode-labels.test.ts` that imports the `MODES` constant extracted from the page

### Implementation for User Story 2

- [ ] T013 [US2] Update `MODES` labels in `app/(app)/quiz/municipality/page.tsx` per `specs/024-conquest-mode-a/contracts/dashboard-top.md` (extract `MODES` if needed so T012 can import it)

**Checkpoint**: モード選択だけ見て役割が分かる

---

## Phase 5: User Story 3 - おすすめはAかDを半々し、その地方の未制覇難易度を出す (Priority: P1)

**Goal**: おすすめを A/D 抽選＋地方90%引き直し＋最易未制覇難易度＋未クリア優先にする。A 苦戦時のみ B/C へ1回差し替え。セッションは開始〜退出。D はモード固定。

**Independent Test**: 苦戦前・最小マス前は A/D がおよそ半々。A で北海道単独にならない。入門90%中級50%なら中級。90%地方は引き直し。A 低正答なら B/C で D に落ちない。同マス B/C が低くなければ A。片方だけ低ければその形式。D 引きは落とさない。1問保存して抜けたら推薦が古く残らない。差し替え1回。連続 A は別セッション。途中退出は答えた問だけが分母。

### Tests for User Story 3

- [ ] T014 [US3] Write failing case-table tests for A/D coin, Hokkaido exclusion, 90% redraw, easiest uncleared difficulty, min-coverage cells, struggle swap, swap-once, D no-swap, cold start no-swap in `__tests__/lib/quiz/recommendation-conquest-lottery.test.ts` with injected `random` (`specs/024-conquest-mode-a/contracts/recommend-engine.md`)
- [ ] T015 [P] [US3] Write failing tests that Mode A same-name multi-prefecture rows normalize to one question for session accuracy in `__tests__/lib/quiz/quiz-results.test.ts` or a session helper test next to `lib/quiz/recommendation/history-cache.ts`

### Implementation for User Story 3

- [ ] T016 [US3] Implement mode-specific region×difficulty coverage (A=name with current same-name exclusion; D=code; Hokkaido omitted from A lottery「全市」) in `lib/quiz/recommendation/coverage-cells.ts`
- [ ] T017 [US3] Replace `generateRecommendation` lottery (drop Fit Zone / nationwide B cold-start on this path) in `lib/quiz/recommendation/engine.ts`
- [ ] T018 [US3] Extend recommendation history with last A/B/C sessions, `quizSessionId` at quiz start, swapConsumed, display-1問 accuracy; pass into `getRecommendation` in `lib/quiz/recommendation/history-cache.ts`, `lib/quiz/recommendation/types.ts`, `app/(app)/quiz/municipality/actions.ts`, `lib/hooks/useRecommendation.ts`, `app/(app)/quiz/municipality/[mode]/page.tsx`
- [ ] T019 [US3] After ≥1 saved answer and session exit (complete / abort / popstate / replay), invalidate `queryKeys.recommendation()` once saves finish in `app/(app)/quiz/municipality/[mode]/page.tsx` and `lib/hooks/useRecommendation.ts`
- [ ] T020 [US3] Keep recommend auto-start on the chosen mode×region×difficulty with 022 uncleared-first; D uses code identity from T003 in `lib/quiz/recommend-auto-start.ts`

**Checkpoint**: おすすめ単体で SC-004–007, 013–014 をテストと画面で確認できる

---

## Phase 6: User Story 4 - トップから外した数字は詳細分析で見る前提にする (Priority: P2)

**Goal**: トップから正答率推移・苦手ランキング・B/C 練習数字を外す。詳細分析ページは作らない。

**Independent Test**: トップをスクロールしても推移グラフ・苦手ランキング・B/C クリアが無い。仕様に移管前提が残っている。

### Tests for User Story 4

- [ ] T021 [US4] Tests not applicable for page deletion; confirm `spec.md` Out of Scope / FR-017 still states 詳細分析 is a follow-up spec (no new page)

### Implementation for User Story 4

- [ ] T022 [US4] Remove AccuracyChart, WeaknessRanking, combined CompletionChart/FilterBar from the top in `components/dashboard/dashboard-client.tsx` (keep RecommendHeroCard, ReviewCard, A/D bars from T011)

**Checkpoint**: トップはおすすめと A/D と復習だけ

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 横断確認。詳細分析ページは作らない。

- [ ] T023 [P] Confirm SRS review stays mode-scoped (A correct does not clear B/C/D due) via existing `__tests__/lib/quiz/srs/` (add a one-liner regression only if a change touched `lib/quiz/srs/`)
- [ ] T024 Run `specs/024-conquest-mode-a/quickstart.md` locally (mode labels, two bars, D wards, recommend refresh)
- [ ] T025 Run `pnpm test`, `pnpm type-check`, `pnpm lint:ratchet`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 即開始可
- **Foundational (Phase 2)**: Setup 後。全 US をブロック
- **US1 (Phase 3)**: Foundational 後。MVP
- **US2 (Phase 4)**: Foundational 後。US1 とファイル衝突なし（モード選択ページ）
- **US3 (Phase 5)**: Foundational 後。D identity (T003) に依存。バー UI には非依存
- **US4 (Phase 6)**: T011 のあとに同じ `dashboard-client.tsx` を触るので US1 の後が安全
- **Polish**: 欲しい US のあと

### User Story Dependencies

- **US1**: Foundational のみ
- **US2**: Foundational のみ。US1 と並列可
- **US3**: Foundational の D identity。US1 バーとは独立にテスト可
- **US4**: US1 のダッシュボード変更の続き

### Within Each User Story

- テストを先に書き、赤を確認してから実装
- 地図・判定・ラベルはバーより先でも後でも可（US1 内）
- US3 は coverage 純粋関数 → engine → history/invalidate

### Parallel Opportunities

- T004 / T005 と T002 / T003
- T006 と T007
- US2 は US1 実装と並列
- T014 と T015

---

## Parallel Example: User Story 1

```bash
Task: "Failing D tap tests in __tests__/components/quiz/use-quiz-actions-mode-d.test.ts"
Task: "Failing map merge tests in __tests__/components/map/municipality-map-merge.test.ts"
```

## Parallel Example: User Story 3

```bash
Task: "Failing lottery case table in __tests__/lib/quiz/recommendation-conquest-lottery.test.ts"
Task: "Failing Mode A session accuracy normalize tests"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1–2（D identity + 区ラベル）
2. Phase 3 US1（2本バー + D コード正誤・地図）
3. STOP: トップと D 政令市を確認

### Incremental Delivery

1. Setup + Foundational
2. US1 MVP
3. US2 ラベル
4. US3 おすすめ（本仕様の本体）
5. US4 トップから分析を外す
6. Polish / quickstart

### Parallel Team Strategy

- Foundational 共有後: A が US1 地図/判定、B が US1 ダッシュボード、C が US2、D が US3 テスト先行

---

## Notes

- 023 は実装しない。本仕様が正
- `municipality_master.name` を区名に戻さない
- 新テーブル / `session_id` 列は必須としない
- おすすめ経路で Fit Zone を使わない。デッドコード削除は必須ではない
- 詳細分析ページは作らない
