# Tasks: 今日のおすすめクイズにおける地域選択（絞り込み）機能の改善

**Input**: Design documents from `/specs/011-recommend-region-filter/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/region-filter.md, quickstart.md

**Tests**: 絞り込み・判定ロジックに対する Vitest 単体テストを含む（FR-004、プロジェクト方針: 純粋関数＋Vitest）。UI レンダリングは手動確認。

**Organization**: タスクはユーザーストーリー単位。US1（地方選択）が P1 (MVP) であり、US2（都道府県選択）、US3（永続化）は独立して実装・検証可能。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 別ファイル・依存なしで並行実行可能
- **[Story]**: US1 / US2 / US3

## Path Conventions

Next.js 単一プロジェクト（App Router）。ロジックは `lib/quiz/`、UI コンポーネントは `components/recommend/`、クイズ画面は `app/(app)/quiz/municipality/[mode]/`。

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 既存の再利用資産の確認

- [ ] T001 `lib/quiz/municipality-data.ts` の `PREFECTURE_TO_REGION` と `ALL_PREFECTURES` が import して使用可能であることを確認する。

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 各ストーリーが依存する判定ロジックの準備

- [ ] T002 `lib/quiz/municipality-data.ts` の `isModeAvailable` を拡張し、地方（`regions`）の代わりに都道府県（`prefectures`）が明示されている場合でも、選択された都道府県数が2件以上あるなら Mode B をプレイ可能と判定するように修正する。
- [ ] T003 `__tests__/lib/quiz/recommend-region-filter.test.ts` を新規作成し、T002 の都道府県による `isModeAvailable` の挙動をテスト検証する。

**Checkpoint**: 判定ロジックの基盤が確立。UI 実装に移行可能。

---

## Phase 3: User Story 1 - 地方単位でのポジティブな絞り込み (Priority: P1) 🎯 MVP

**Goal**: 調整ダイアログで「除外する地方」の代わりに「対象とする地方」をトグル選択し、その条件でクイズを開始・出題できる。

**Independent Test**: おすすめクイズ開始前の調整ダイアログで「東北」のみを選択して開始し、出題される市区町村がすべて東北地方のものであることを確認する。

### Implementation for User Story 1

- [ ] T004 [US1] `components/recommend/recommend-override.tsx` の UI を修正し、「除外する地方」を廃止して「対象地域（地方トグルボタン）」をポジティブに複数選択できる UI を実装する。（※「全国」選択トグルを設け、全国がオンまたは全選択解除時はフィルタなしとする）
- [ ] T005 [US1] `components/recommend/recommend-content.tsx` において、`overrides.targetRegions` が存在する場合はそのリストをカンマ区切りの文字列にして URL の `region` パラメータへ付与して遷移するようにする。
- [ ] T006 [US1] `app/(app)/quiz/municipality/[mode]/page.tsx` において、URL クエリパラメータの `region` にカンマ区切りで複数地方名が含まれる場合にそれらをパースして `Settings.regions` の初期状態に正しく反映できるようにする。

**Checkpoint**: 地方単位でのポジティブな絞り込みが機能し、クイズプレイに反映される（MVP完了）。

---

## Phase 4: User Story 2 - 都道府県単位でのポジティブな絞り込み (Priority: P2)

**Goal**: 地方を選択した際、その地方に属する都道府県リストを展開し、さらに都道府県単位で個別にオン/オフを切り替えて絞り込める。

**Independent Test**: 「東北」を選択し、展開された県から「宮城県」「福島県」のみをオンにして開始。出題される問題がすべて指定の2県のみであることを確認する。

### Implementation for User Story 2

- [ ] T007 [US2] `components/recommend/recommend-override.tsx` において、選択された地方（例: 「東北」）がある場合、その地方に属する都道府県ボタン（トグル）が下部に動的に展開されるアコーディオンUI（React state によるトグル表示）を追加する。
- [ ] T008 [US2] `components/recommend/recommend-content.tsx` において、選択された都道府県リスト（`targetPrefectures`）が存在する場合はそれを URL の `prefectures` クエリパラメータへ付与して遷移する処理を追加する。
- [ ] T009 [US2] `app/(app)/quiz/municipality/[mode]/page.tsx` の初期パース処理を拡張し、URL の `prefectures` がある場合は `Settings.prefectures` に設定し、`buildQuestions` 内で都道府県レベルでのフィルタ処理を適用する。また、対象プールが0件の場合に開始ボタンを非活性（Disabled）化し警告表示するエラーハンドリングを実装する。

**Checkpoint**: 地方および都道府県の両方のネストされたポジティブ絞り込みが完了し、問題なしに出題される。

---

## Phase 5: User Story 3 - 設定の永続化と通常クイズ設定への連動 (Priority: P3)

**Goal**: 調整ダイアログで選択した地方および都道府県を LocalStorage に保存し、ダイアログを再起動した際に自動的に復元する。

**Independent Test**: ダイアログで「東北」の「宮城県」を選択してクイズを開始し、結果画面から戻って再度ダイアログを開いた際、選択状態が保持されていることを確認する。

### Implementation for User Story 3

- [ ] T010 [US3] `components/recommend/recommend-override.tsx` 内で、選択された `targetRegions` および `targetPrefectures` を LocalStorage（キー: `geodojo-recommend-region-filters`）に JSON 形式で永続化保存し、マウント時にその初期状態を復元するロジックを実装する。

---

## Phase 6: User Story 4 - 制覇率に基づく難易度ステップアップ制限 (Priority: P2)

**Goal**: 正答率が高くても、現在の最高難易度セルの制覇率が 90% 未満ならおすすめクイズで次の難易度へ進行しないようにする。

**Independent Test**: easy 難易度の正答率移動平均が 100% だが、制覇率が 50% の状態でおすすめの推薦を取得した際、提案される難易度が `easy` のままであり、`medium` に進行しないことを検証するテストを実行する。

### Implementation for User Story 4

- [ ] T011 [US4] `lib/quiz/recommendation/axes/progression.ts` の `evaluateProgression` を拡張し、引数として `cellCoverages` を受け取れるようにする。また、現在の `maxDifficulty` のセルの平均制覇率が 90% 未満の場合、`isProgressionFired: false` として難易度のステップアップ（`nextDifficulty` の適用）をロックするロジックを実装する。
- [ ] T012 [US4] `lib/quiz/recommendation/engine.ts` において、`evaluateProgression` の呼び出し時に `state.cellCoverages` を引数として渡すように修正する。
- [ ] T013 [US4] `__tests__/lib/quiz/recommendation-progression.test.ts` を新規作成し、正答率が高くても制覇率が 90% 未満の場合にステップアップが抑制され、90% 以上のときにステップアップが発生することをアサートする Vitest 単体テストを追加する。

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: コード品質の担保と最終検証

- [ ] T014 `pnpm lint` を実行し、型チェックと ESLint をパスさせる。
- [ ] T015 `pnpm test` を実行し、既存テストおよび新規作成したテストをすべてパスさせる。
- [ ] T016 `quickstart.md` の手動確認手順を実行し、すべての機能の組み合わせと LocalStorage 連動が正常であることを最終確認する。

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 依存なし
- **Foundational (Phase 2)**: Setup 完了後
- **US1 (Phase 3)**: Foundational 完了後
- **US2 (Phase 4)**: US1 完了後（URLパラメータの遷移連携に依存するため）
- **US3 (Phase 5)**: UI構築完了後（US1/US2 に依存）
- **Polish (Phase 6)**: 全機能実装完了後

### Parallel Opportunities

- T003（テスト作成）は、ロジック定義（T002）と並行して進めることができる。
- T011（Lintチェック）と T012（テスト実行）は並行可能。
