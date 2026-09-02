# Tasks: Mode D（順引き地図）市区町村出題選択・絞り込み

**Feature**: Mode D（順引き地図）市区町村出題選択・絞り込み
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Phase 1: Setup

**Purpose**: Baseline sanity check

- [X] T001 Verify baseline type-check and test suite (`pnpm type-check && pnpm test`)

---

## Phase 2: Foundational (Core Scope Logic & Pure Functions)

**Purpose**: Core scope data models and filtering functions required by all user stories

**⚠️ CRITICAL**: Must be complete before UI and integration

- [X] T002 [P] Implement `ScopeType`, `MunicipalityScope`, `filterByScope`, and `isScopeAvailable` in `lib/quiz/municipality-data.ts`
- [X] T003 [P] Create unit tests for scope filtering in `__tests__/lib/quiz/municipality-scope.test.ts`
- [X] T004 Extend `MunicipalityQuizSettings` in `lib/quiz/municipality-questions.ts` to support `scope: MunicipalityScope` with backwards-compatibility for `regions: Region[]`
- [X] T005 Update `__tests__/lib/quiz/municipality-questions.test.ts` to add tests for questions generation with prefecture and custom code pools

**Checkpoint**: Foundation ready - pure functions and sampling support prefecture & custom pool scoping

---

## Phase 3: User Story 1 - 都道府県単位での集中学習 (Priority: P1) 🎯 MVP

**Goal**: ユーザーが Mode D 設定画面で都道府県を選択し、指定都道府県内の市区町村クイズを開始できる

**Independent Test**: 設定画面で「長野県」を選択し、長野県内の市区町村クイズが生成・表示され回答できる

- [X] T006 [P] [US1] Create `components/quiz/scope-selector.tsx` with region vs prefecture toggle and region-grouped prefecture picker
- [X] T007 [US1] Integrate `ScopeSelector` into `app/(app)/quiz/municipality/[mode]/page.tsx` and connect with `filteredPool` and `QuizPoolProgress`
- [X] T008 [US1] Verify end-to-end Mode D start with single prefecture selection and map rendering

**Checkpoint**: MVP complete - users can target specific prefectures in Mode D

---

## Phase 4: User Story 2 - 都道府県内の市区町村個別選択・除外 (Priority: P2)

**Goal**: ユーザーが都道府県内の市区町村一覧から特定の自治体を個別選択/除外してカスタム特訓できる

**Independent Test**: 都道府県内の市区町村一覧から3自治体のみを選択してクイズを開始し、その3自治体のみが出題される

- [X] T009 [P] [US2] Create `components/quiz/municipality-picker-dialog.tsx` with search filter, select all / deselect all, and municipality list items (kana, difficulty, cleared badge)
- [X] T010 [US2] Add dialog trigger button and state wiring for `selectedCodes` in `app/(app)/quiz/municipality/[mode]/page.tsx`
- [X] T011 [US2] Add pool count warning and validation when selected count is less than session question count

**Checkpoint**: User Stories 1 and 2 work independently

---

## Phase 5: User Story 3 - 既存学習オプション（未クリア優先・苦手優先・難易度）との連動 (Priority: P2)

**Goal**: カスタムプール内でも「難易度」「未クリア優先」「苦手優先」が正確に適用される

**Independent Test**: 特定都道府県の未クリア優先をONにしてクイズを生成し、未クリア自治体が先頭にサンプリングされる

- [X] T012 [US3] Ensure difficulty filtering, uncleared-first, and weakness-first properly prioritize within the custom scoped pool in `app/(app)/quiz/municipality/[mode]/page.tsx`
- [X] T013 [US3] Add integration test for custom pool + unclearedFirst / weaknessFirst in `__tests__/lib/quiz/municipality-scope.test.ts`

**Checkpoint**: All learning options integrate seamlessly with custom pools

---

## Phase 6: User Story 4 - 選択状態の URL 保持とリプレイの再現性 (Priority: P3)

**Goal**: 都道府県や個別コードの選択状態が URL クエリパラメータおよび localStorage に保持され、リプレイや再訪時に復元される

**Independent Test**: URL に `?scope=prefecture&pref=長野県&codes=20201,20202` を付与してアクセスした際、指定自治体が初期選択された状態で設定画面がロードされ、「もう一度」で同一設定が維持される

- [X] T014 [P] [US4] Implement `parseScopeFromSearchParams` and URL query serialization helpers in `lib/quiz/municipality-data.ts`
- [X] T015 [US4] Update `app/(app)/quiz/municipality/[mode]/page.tsx` to initialize scope from URL search params and persist latest settings to `localStorage`
- [X] T016 [US4] Ensure `handleReplay` preserves custom scope settings when refetching cleared/weakness queries

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Quality assurance, responsiveness, and regression test verification

- [X] T017 [P] Verify responsive layout and touch targets on mobile (375px width) for `ScopeSelector` and `MunicipalityPickerDialog`
- [X] T018 Run full quality gate checks (`pnpm type-check && pnpm test && pnpm lint && pnpm lint:ratchet`)

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Phase 1 - BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2
- **US2 (Phase 4)**: Depends on Phase 2 and US1
- **US3 (Phase 5)**: Depends on Phase 2 and US1/US2
- **US4 (Phase 6)**: Depends on Phase 2 and US1/US2
- **Polish (Phase 7)**: Depends on all implementation phases

### Parallel Opportunities
- T002, T003 can be authored in parallel
- T006, T009 can be built as standalone UI components in parallel
- T014 can be developed in parallel with UI tasks

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Complete Setup (T001) + Foundational (T002-T005)
2. Complete US1 (T006-T008)
3. Validate single prefecture Mode D quiz execution

### Incremental Delivery
1. US1: Prefecture-level selection in Mode D (MVP)
2. US2: Individual municipality picker with search & batch toggle
3. US3: Mastery & difficulty option synergy
4. US4: URL params & replay persistence
5. Polish: Mobile layout verification & full CI check
