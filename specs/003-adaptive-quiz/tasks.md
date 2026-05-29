---

description: "Task list for おすすめクイズ (適切クイズ推薦)"
---

# Tasks: おすすめクイズ（適切クイズ推薦）

**Input**: Design documents from `/specs/003-adaptive-quiz/`
**Prerequisites**: plan.md ✅ / spec.md ✅ / research.md ✅ / data-model.md ✅ / contracts/server-actions.md ✅ / quickstart.md ✅

**Tests**: spec / plan で明示的なテスト要求はないため、自動テストタスクは含めない。型チェック（`pnpm lint`）+ 手動テスト（quickstart.md の 6 シナリオ）で品質を担保する。

**Organization**: タスクはユーザーストーリーごとにフェーズ分けし、各 P1/P2/P3/P4 が独立にテスト・デリバリ可能なように設計。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 別ファイル・別領域なので並列実行可能
- **[Story]**: US1 / US2 / US3 / US4（US1a は内部多軸ロジック、US1 にまとめる）
- 全タスクに絶対的なファイルパスを含める

## Path Conventions

Next.js App Router 構成（`app/` / `components/` / `lib/`）をリポジトリルートに配置（plan.md 参照）。

---

## Phase 1: Setup（共通インフラ）

**目的**: フィーチャー作業開始前の依存追加と新規ディレクトリ作成。

- [X] T001 shadcn/ui Sheet コンポーネントを追加する。`ls components/ui/sheet.tsx` で存在を確認し、未導入なら `pnpm dlx shadcn@latest add sheet` を実行。生成された `components/ui/sheet.tsx` をコミット
- [X] T002 新規ディレクトリ作成: `mkdir -p lib/quiz/recommendation/axes components/recommend`（`.gitkeep` は不要、後続タスクで実体ファイルを作成）

---

## Phase 2: Foundational（全 US の前提）

**目的**: 全 US が依存する共有型定義の整備。

**⚠️ CRITICAL**: 完了するまで US1 以降の実装に着手しない。

- [X] T003 推薦エンジンの全型定義を `lib/quiz/recommendation/types.ts` に作成。`data-model.md` § 1〜7 に基づき `Cell` / `Session` / `CellAccuracy` / `CellCoverage` / `FitZone` / `LearnerState` / `Recommendation` / `RecommendationHistoryCache` / `RationaleCategory` 等を定義。既存の `lib/quiz/municipality-data.ts` から `GameMode` / `Difficulty` / `Region` / `DIFFICULTIES` / `REGIONS` を import して再利用

**Checkpoint**: 共有型が整備完了 → 全 US の並列実装可能

---

## Phase 3: User Story 1 - ワンタップで「自分に適したクイズ」を開始（Priority: P1）🎯 MVP

**Goal**: ユーザーがダッシュボードまたはクイズトップのヒーローカードをタップすると、学習履歴に基づき自動選定された推薦セッション（10〜20 問）を 2 タップ以内で開始できる。多軸推薦エンジン（US1a）も本フェーズで実装。

**Independent Test**: ダッシュボード `/` を開いて「✨ 今日のおすすめクイズ」ヒーローカードをタップ → ボトムシートに推薦内容が表示 → 「そのまま開始」 → 推薦パラメータで第 1 問が表示されれば完了。

### 推薦エンジン本体（US1a 多軸ロジック）

- [X] T004 [P] [US1] `lib/quiz/recommendation/cell-stats.ts` 作成。`inferSessions(rows)`（同一 mode × 時間差 ≤ 30 分 × 行数 10/20/30 一致でセッション抽出）と `computeCellAccuracies(sessions, masterMap)`（セッションごとに (難易度,地方,モード) 占有率 50% 以上でセル所属判定 → 各セルの直近 5 セッション正答率移動平均 + バックオフ 4 段）を純粋関数として実装。`data-model.md` § 1, 2 参照
- [X] T005 [P] [US1] `lib/quiz/recommendation/axes/exploration.ts` 作成。`selectExplorationPool(allMaster, cellAccuracies, cellCoverages, fitZone)` で「未プレイセル or `coverageRate` 下位 25% セル」内の市区町村プールを返す純粋関数として実装。`data-model.md` § 4, spec FR-006a 参照
- [X] T006 [P] [US1] `lib/quiz/recommendation/axes/coverage.ts` 作成。`selectCoverageCodes(fitZone, allMaster, playedCodes, count)` で Fit Zone 内セルから未経験市区町村を最低 20%（標準 30%）抽出する純粋関数。プール枯渇時は 30 日以上経過の既習プールで代替。spec FR-006c 参照
- [X] T007 [P] [US1] `lib/quiz/recommendation/axes/progression.ts` 作成。`evaluateProgression(fitZone, lastSessionAccuracy)` で成長軸発火（`isProgressionFired`）と後退抑制（`isRegressionGuarded`）を判定する純粋関数。隣接単方向昇格（☆→☆☆→☆☆☆→☆☆☆☆、スキップ禁止）+ 達人天井時の代替策（別地方広域化 → モード変更）を返す。spec FR-006b, FR-006d 参照
- [X] T008 [P] [US1] `lib/quiz/recommendation/rationale.ts` 作成。`selectRationale(recommendation, flags)` で 8 カテゴリ（`cold-start` / `regression` / `difficulty-step-up` / `mode-change` / `bridging` / `weakness-focused` / `review-timing` / `new-exploration`）から優先順位に基づき 1 つ選択し、テンプレート展開した文字列を返す純粋関数。`research.md` R-008 参照
- [X] T009 [US1] `lib/quiz/recommendation/fit-zone.ts` 作成。`extractFitZone(cellAccuracies)` で 60% ≤ 移動平均 ≤ 80% のセル集合 + `maxDifficulty` + `isCappedAt` フラグを返す純粋関数。T004 依存。spec FR-005, FR-006 参照
- [X] T010 [US1] `lib/quiz/recommendation/engine.ts` 作成。`generateRecommendation(state: LearnerState, excludeCodes: string[]): Recommendation` をメインエントリとして実装。フローは (1) コールドスタート判定 → (2) 後退抑制判定 → (3) Fit Zone 抽出 → (4) 成長軸評価 → (5) プール構成（50% Fit 苦手 + 20% カバレッジ + 30% 探索）→ (6) `weightedSample` で問題選定（`excludeCodes` に対し重み 0.3 倍ペナルティ）→ (7) 問題数決定（直近 10 セッションの最頻値、コールドスタート 10）→ (8) 不足分ランダム補充 → (9) 根拠文選択（T008）。T004–T009 依存。spec FR-003〜FR-006d 参照
- [X] T011 [P] [US1] `lib/quiz/recommendation/history-cache.ts` 作成。クライアント側の `localStorage` I/O を提供する `readRecommendationHistory()` と `writeRecommendationHistory(codes)` を実装。キー `geodojo:recommendation:history`、24 時間で expire。SSR ガード（`typeof window === 'undefined'` で no-op）。`research.md` R-005, `data-model.md` § 7 参照

### Server Action と TanStack Query Hook

- [X] T012 [US1] `app/(app)/quiz/municipality/actions.ts` に `getRecommendation(input)` Server Action を追加。`createServerClient().auth.getUser()` で認証、既存 `checkRateLimit` を流用、`buildLearnerState(userId)` 私関数で DB クエリ集計（`municipality_quiz_results` / `municipality_master` + クラウド平均集計）して `LearnerState` を構築、`generateRecommendation(state, input.excludeCodes ?? [])` を呼ぶ。`contracts/server-actions.md` § 1 参照。T010 依存
- [X] T013 [US1] `lib/hooks/useRecommendation.ts` を新規作成。TanStack Query `useQuery` で `queryKey: ['recommendation']`、`queryFn` 内で `readRecommendationHistory()` から `excludeCodes` を取得して `getRecommendation` を呼ぶ、`staleTime: 0`、`refetchOnMount: 'always'`、`refetchOnWindowFocus: false`。`quickstart.md` ステップ 5 参照。T011, T012 依存

### UI コンポーネント（US1 用シェル）

- [X] T014 [P] [US1] `components/recommend/recommend-hero-card.tsx` を作成。`useRecommendation` を購読し、タイトル「✨ 今日のおすすめクイズ」/ 根拠文 1 行（プレースホルダ、US2 で詳細化）/ 構成サマリー（モード・難易度・地方・問題数）/ 主 CTA ボタンを描画。CTA タップで `recommend-sheet` を開く（URL クエリ `?recommend=open` 切替）。ローディング中はスケルトン、エラー時はトースト + リトライ
- [X] T015 [P] [US1] `components/recommend/recommend-sheet.tsx` を作成。shadcn/ui `<Sheet side="bottom">` ラッパー。`open` / `onOpenChange` を URL クエリ `?recommend=open` と同期、ブラウザ戻るで閉じられるようにする。子要素として `<RecommendContent />` を表示。`research.md` R-006 参照
- [X] T016 [US1] `components/recommend/recommend-content.tsx` を作成。シート内のメインコンテンツ。📊 推薦内容（モード・難易度・地方・問題数）/ 💡 根拠文プレースホルダ（US2 で展開）/ 🔧「内容を変える」折りたたみセクション（プレースホルダ、US3 で展開）/ sticky bottom に「そのまま開始」主 CTA + 「キャンセル」副 CTA。「そのまま開始」タップで `writeRecommendationHistory(recommendation.codes)` を呼んでから `/quiz/municipality/{mode}?source=recommend&codes=...&difficulty=...&region=...&count=...` へ遷移。T014, T015 依存

### 既存ページへの差し込み

- [X] T017 [P] [US1] `app/(app)/page.tsx` を編集。`<MilestoneBanner />` の直下、`<SummaryCards />` の上に `<RecommendHeroCard />` を挿入。`summary && summary.totalQuestions > 0` 条件ブロックの **外** に置き、履歴ゼロでも表示されるようにする（コールドスタート対応 FR-009）。spec § UI 配置と見せ方 参照
- [X] T018 [P] [US1] `app/(app)/quiz/municipality/page.tsx` を編集。モード A/B/C/D カード群の最上段に `<RecommendHeroCard />` を挿入。ダッシュボードと同じコンポーネントを再利用
- [X] T019 [US1] `app/(app)/quiz/municipality/[mode]/page.tsx` を編集。`useSearchParams()` で `source`, `codes`, `difficulty`, `region`, `count` を読み取り、`source === 'recommend'` のとき `setSettings` 初期値を上書き + `buildQuestions` の前段に `if (codes) filtered = filtered.filter(m => codes.includes(m.code))` を追加。既存 `weightedSample` のフローはそのまま流用。spec FR-017、`contracts/server-actions.md` § URL クエリ契約 参照

**Checkpoint**: US1 完成。ダッシュボード/クイズトップから推薦クイズが 2 タップで開始でき、コールドスタート/通常ユーザーの両方で動作。「もう一度おすすめ」CTA は US4 で追加。根拠文は仮表示（プレースホルダ）。上書きは US3 で追加。

---

## Phase 4: User Story 2 - 推薦内容の根拠を確認（Priority: P2）

**Goal**: 推薦ヒーローカード（1 行）とボトムシート（1〜2 行）に推薦根拠の自然言語テキストを表示し、ブラックボックス感を解消する。

**Independent Test**: 通常ユーザーでログイン → ヒーローカードに根拠 1 行が表示 → ボトムシートを開くと展開された 1〜2 行が表示。コールドスタート / 後退抑制 / 成長軸発火 / 各カテゴリでそれぞれ適切なテンプレートが選ばれる。

### 実装

- [X] T020 [P] [US2] `components/recommend/recommend-rationale.tsx` を作成。`{ category, text, variant: 'card' | 'sheet' }` を受け取り、`variant: 'card'` で 1 行（最大 40 文字に切り詰め）、`variant: 'sheet'` で「💡 なぜこの内容？」見出し + 1〜2 行を描画。カテゴリ別アイコン（lucide-react、例: `Sparkles` / `ShieldAlert` / `TrendingUp`）を表示
- [X] T021 [US2] `components/recommend/recommend-hero-card.tsx` の根拠プレースホルダを `<RecommendRationale category={data.rationaleCategory} text={data.rationaleText} variant="card" />` に置き換え。T014, T020 依存
- [X] T022 [US2] `components/recommend/recommend-content.tsx` の根拠プレースホルダを `<RecommendRationale category={data.rationaleCategory} text={data.rationaleText} variant="sheet" />` に置き換え。T016, T020 依存

**Checkpoint**: US2 完成。8 カテゴリすべての根拠文がヒーローカードとシートで適切に表示される。

---

## Phase 5: User Story 3 - 推薦内容を開始前に微調整（Priority: P3）

**Goal**: ボトムシート内「🔧 内容を変える」を展開してモード（A/B/C/D）・問題数（10/20/30）・除外地方を上書きし、上書き後の設定でクイズを開始できる。

**Independent Test**: ボトムシートで「内容を変える」をタップ → 折りたたみ展開 → モードを A→C に変更 → 「そのまま開始」 → モード C で同じ対象市区町村プールのクイズが開始される。

### 実装

- [X] T023 [P] [US3] `components/recommend/recommend-override.tsx` を作成。React state 管理で `{ mode, count, excludedRegions }` を保持し、`onChange(overrides)` で親に伝達。UI は折りたたみセクション内に: モード切替（A/B/C/D の SegmentedControl 風ボタン群）/ 問題数（10/20/30 のラジオ）/ 除外地方（チェックボックスリスト、8 地方）。初期値は推薦エンジンの提案値
- [X] T024 [US3] `components/recommend/recommend-content.tsx` のプレースホルダを `<RecommendOverride initial={recommendation} onChange={setOverrides} />` に置き換え、「そのまま開始」ボタンタップ時に `overrides` を URL クエリにマージして遷移。除外地方が指定されたとき `regions` クエリから該当地方を削除。問題数変更時はプール不足注記を表示（FR-013）。T016, T023 依存

**Checkpoint**: US3 完成。ユーザーが推薦内容を 3 軸（モード・問題数・地方）で上書きしてクイズを開始できる。

---

## Phase 6: User Story 4 - 結果に基づく次回推薦への反映（Priority: P4）

**Goal**: クイズ完了時に結果が `municipality_quiz_results` に保存され（既存）、結果画面の「もう一度おすすめでプレイ」CTA から次回推薦を最新の学習状態で再生成できる。

**Independent Test**: おすすめクイズで特定市区町村を不正解 → 結果画面の「もう一度おすすめでプレイ」をタップ → ボトムシート再表示 → その市区町村が次回推薦プールに含まれる + 直前と少なくとも 50% は入れ替わる（FR-014）。

### 実装

- [X] T025 [P] [US4] `components/recommend/recommend-replay-button.tsx` を作成。`onClick` で URL クエリ `?recommend=open` を付与してダッシュボードへ遷移（または現在ページでシートを開く）。「もう一度おすすめでプレイ」ラベル + accent color
- [X] T026 [US4] `app/(app)/quiz/municipality/[mode]/page.tsx` の `phase === 'result'` ブロックを編集。`searchParams.get('source') === 'recommend'` のとき、既存の「もう一度」「設定に戻る」ボタン群の **上** に `<RecommendReplayButton />` を主 CTA として挿入。T019 で受け取った `source` フラグを再利用。T025 依存
- [X] T027 [US4] `app/(app)/quiz/municipality/[mode]/page.tsx` の `setPhase('result')` 直前または結果保存後に `writeRecommendationHistory(playedCodes)` を呼ぶ（クライアント側 import）。playedCodes は今回出題された `municipality_code` 集合。T011 依存

**Checkpoint**: US4 完成。完走後の「もう一度おすすめでプレイ」で常に最新状態の推薦が手に入る。FR-014（50% 入れ替え）が機能する。

---

## Phase 7: Polish & Cross-Cutting Concerns

**目的**: 全 US 完了後の品質確認と仕上げ。

- [X] T028 [P] `pnpm lint` を実行し、新規追加コードの型エラー・lint 警告をゼロにする
- [ ] T029 [P] Chrome DevTools のデバイスエミュレータで 375px 幅に設定し、`/`（ダッシュボード）と `/quiz/municipality` でヒーローカードが横スクロールなしで表示されること、ボトムシート展開時も sticky CTA が常に画面内にあることを目視確認（Constitution III）
- [ ] T030 [P] `quickstart.md` § ステップ 8 の動作確認 6 シナリオ（コールドスタート / 通常ユーザー / 成長軸発火 / 後退抑制 / もう一度おすすめ / localStorage）を順次実行し、すべて成功することを目視確認
- [ ] T031 [P] `lib/quiz/recommendation/` 配下の純粋関数（cell-stats / fit-zone / axes/* / rationale / engine）に対する軽量ユニットテストの追加を検討（vitest が既存導入なら追加、未導入なら本スコープ外として記録）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 依存なし、即着手可能
- **Phase 2 (Foundational)**: Phase 1 完了に依存。全 US の前提（型定義）
- **Phase 3〜6 (User Stories)**: Phase 2 完了に依存。優先順位順（US1 → US2 → US3 → US4）に進めるか、Phase 2 後に並列着手可能（チーム時）
- **Phase 7 (Polish)**: 全 US 完了に依存

### User Story Dependencies

- **US1 (P1)**: Foundational 完了後に開始。他 US への依存なし
- **US2 (P2)**: Foundational + US1 のヒーローカード / シェル（T014, T016）に依存。独立に動くカードを差し替える形
- **US3 (P3)**: Foundational + US1 の `recommend-content.tsx`（T016）に依存。プレースホルダを置き換える形
- **US4 (P4)**: Foundational + US1 の `[mode]/page.tsx` 修正（T019）と history-cache（T011）に依存

### Within Each User Story

- 純粋関数（types → cell-stats → fit-zone → axes → engine）はボトムアップ
- Server Action は engine に依存
- TanStack Query hook は Server Action に依存
- UI コンポーネントは hook に依存
- ページへの差し込みは UI に依存

### Parallel Opportunities

- **Phase 1**: T001 と T002 は順序依存（T002 はディレクトリだけ）。並列不要
- **Phase 2**: T003 単一タスク
- **Phase 3 (US1)**: 同一エンジン内で並列可能
  - T004〜T008（cell-stats / axes/3 / rationale）は別ファイルで並列可
  - T011（history-cache）も並列可
  - T009 (fit-zone) は T004 依存
  - T010 (engine) は T004–T009 全依存（並列不可）
  - T012 (Server Action) は T010 依存
  - T013 (hook) は T012 依存
  - T014, T015 は別ファイルで並列可（T013 依存）
  - T017, T018 は別ファイルで並列可（T014 依存）
- **Phase 4–6**: それぞれ US 内のタスクは並列可能（T020 と T021/T022 は順序依存）
- **Phase 7**: 全タスク並列可

---

## Parallel Example: User Story 1

```bash
# Phase 3 着手時、エンジン純粋関数を並列で開始：
Task: "T004 [P] [US1] cell-stats.ts in lib/quiz/recommendation/cell-stats.ts"
Task: "T005 [P] [US1] axes/exploration.ts in lib/quiz/recommendation/axes/exploration.ts"
Task: "T006 [P] [US1] axes/coverage.ts in lib/quiz/recommendation/axes/coverage.ts"
Task: "T007 [P] [US1] axes/progression.ts in lib/quiz/recommendation/axes/progression.ts"
Task: "T008 [P] [US1] rationale.ts in lib/quiz/recommendation/rationale.ts"
Task: "T011 [P] [US1] history-cache.ts in lib/quiz/recommendation/history-cache.ts"

# 全完了後に fit-zone → engine を順次：
Task: "T009 [US1] fit-zone.ts"
Task: "T010 [US1] engine.ts"

# Server Action と hook：
Task: "T012 [US1] getRecommendation action"
Task: "T013 [US1] useRecommendation hook"

# UI コンポーネント並列：
Task: "T014 [P] [US1] RecommendHeroCard"
Task: "T015 [P] [US1] RecommendSheet"

# 既存ページ差し込み並列（T014 後）：
Task: "T017 [P] [US1] Insert hero card into dashboard"
Task: "T018 [P] [US1] Insert hero card into quiz top"
```

---

## Implementation Strategy

### MVP First (US1 のみ)

1. Phase 1 (Setup) を完了
2. Phase 2 (Foundational, T003) を完了
3. Phase 3 (US1, T004–T019) を完了
4. **STOP**: US1 の Independent Test 実施。コールドスタート + 通常ユーザー両方でクイズ開始まで通る確認
5. デモ可能 → ステージング deploy → ユーザーテスト

### Incremental Delivery

1. Setup + Foundational + US1 (MVP) → リリース1（推薦内容で開始できる）
2. + US2 → リリース2（根拠が見える、信頼性向上）
3. + US3 → リリース3（柔軟性確保）
4. + US4 → リリース4（継続学習サイクル完成）
5. + Polish → 完成

### Parallel Team Strategy

- 開発者 1 人前提なら US1 → US2 → US3 → US4 の順次実装が現実的
- 複数開発者がいる場合、Foundational 完了後に US2/US3/US4 を並列着手可能。ただし US2/US3 は US1 の UI シェル（T014, T016）が完成してから差し替え作業に入る

---

## Notes

- [P] タスク = 別ファイル・依存タスクが完了済み
- [Story] ラベル = US1 / US2 / US3 / US4 の追跡子
- 各 US はそれ単独で動作・テスト可能（Independent Test 参照）
- 推薦エンジンは純粋関数として実装し、副作用（DB / localStorage）は外部で対応
- 既存テーブル・既存 Server Actions（`saveMunicipalityQuizResult` / `getMunicipalityWeakness` / `getMunicipalityMaster`）は変更しない
- 各 US 完了時にコミットを推奨（後続 PR の差分が小さく保たれる）
- US1 が動けば MVP として 1 つの PR にまとめて出すことも可能
