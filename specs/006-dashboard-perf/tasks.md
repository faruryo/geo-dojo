---
description: "Task list for ダッシュボード表示速度の改善"
---

# Tasks: ダッシュボード（トップ）表示速度の改善

**Input**: Design documents from `/specs/006-dashboard-perf/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: 数値一致リグレッションの Vitest は **必須**（spec Clarifications 2026-06-08 / AC4）。純粋化した read クエリ群に対し固定シードで主要指標の期待値を固定する。

**Organization**: タスクは plan.md の段階リリース（Phase A=クイックウィン / Phase B=アーキ移行 / Phase C=仕上げ）を「独立してテスト・デリバリ可能な3ストーリー」として整理する。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 別ファイル・依存なしで並列実行可
- **[Story]**: US1（クイックウィン）/ US2（プリフェッチ＋ハイドレーション）/ US3（認証最適化＋仕上げ）
- 各タスクに正確なファイルパスを明記

## Path Conventions

- 単一 Next.js アプリ（App Router）。`app/`, `lib/`, `components/`, `__tests__/` はリポジトリ直下。

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 測定基盤とテストの土台を整える（コードのロジック変更なし）

- [ ] T001 [P] ベースライン指標を `specs/006-dashboard-perf/quickstart.md` の HAR 解析スニペットで再確認し、改修前の `POST count / overlapping pairs / 総ウォール時間` を `specs/006-dashboard-perf/baseline-metrics.md` に記録（改修後比較用）
- [X] T002 [P] Vitest シード方針確定（`vitest.config.ts` の `__tests__/**/*.test.ts`・`environment:'node'`・`@` エイリアスを流用）。`__tests__/lib/dashboard/fixtures/` 作成。DB 統合テストは `DATABASE_URL` 有無で実行/スキップを切替

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: US1/US2 の数値一致テストが共有する「シード＋期待値（ゴールデン）」と純粋クエリの置き場を用意する

**⚠️ CRITICAL**: ここが終わるまで US1/US2 のテストは書けない（共有シードに依存）

> **✅ ブロッカー解消**: ローカル supabase（`pnpm dev` の `supabase start`、DB=`postgresql://postgres:postgres@127.0.0.1:54322/postgres`）を DB エミュレータとして利用し DB 統合テストを実装。`DATABASE_URL` 未設定時は `describe.skipIf` でスキップし既定 `pnpm test` を壊さない（CI 安全）。`user_id` に FK が無いことを確認し、ランダム synthetic userId で隔離シード→テスト後 cleanup（orphan 0 を確認）。

- [X] T003 read クエリの純粋関数置き場 `app/(app)/dashboard/queries.ts` を新規作成（`stripDates`/`serialize`/`getMasterPoolSize` を `actions.ts` から移設し双方で再利用。`getDashboardSummaryData(userId)` を追加。発行 SQL・集計ロジック・返却 shape は不変）
- [X] T004 隔離シード `__tests__/lib/dashboard/seed.ts` を作成（ランダム synthetic userId に既知の回答ログ7件=prev4/today3 を投入、`cleanupSummaryUser` で完全削除）。`municipality_master` は既存流用
- [X] T005 ゴールデン期待値 `__tests__/lib/dashboard/fixtures/expected-metrics.ts` を固定（`totalQuestions`/`totalCorrect`/`overallAccuracy`/`studiedCount`/`clearedCount`/`prev.*`）。coverageRate は master 依存=環境依存のためテスト側で同一式から導出して照合。注: streak / weakness / dueCount 等は US2 で残り read を純粋化する際に T012 で拡充

**Checkpoint**: 共有シード＋ゴールデン値が確定。US1/US2 はこれに対して数値一致を検証できる

---

## Phase 3: User Story 1 - クイックウィン（重複排除＋Promise.all） (Priority: P1) 🎯 MVP

**Goal**: アーキ変更前に、`getRecommendation` の重複（約3.5秒）と `getDashboardSummary` の直列10クエリを解消して体感を即改善する（AC2、AC5の一部）

**Independent Test**: HAR 再取得で `getRecommendation` の二重発火が消え、`getDashboardSummary` 相当の単発時間が短縮。Vitest で summary 系指標がゴールデンと一致（リグレッションなし）

### Tests for User Story 1 (必須) ⚠️

> 実装前にテストを書き、シード未対応で FAIL することを確認する

- [X] T006 [P] [US1] `__tests__/lib/dashboard/summary.test.ts` を作成し、`getDashboardSummaryData(userId)` の返却がゴールデンと一致することを検証。**結果: DB ありで 43 passed / DB なしで 3 skipped**。テストが既存挙動（`studiedCount`/`clearedCount` は raw `COUNT(DISTINCT)` のため文字列で返る）を捕捉、`Number()` で値照合

### Implementation for User Story 1

- [X] T007 [US1] `app/(app)/dashboard/actions.ts` の `getDashboardSummary` 本体ロジックを `getDashboardSummaryData(userId)` として `app/(app)/dashboard/queries.ts` へ抽出（認証非依存・`userId` 引数化）。`actions.ts` 側は `requireUser()` → `getDashboardSummaryData(user.id)` を呼ぶ薄いラッパに変更
- [X] T008 [US1] `getDashboardSummaryData` 内の相互依存のない集計を `Promise.all` 化。実装メモ: `totalSlots` 含め全9クエリは相互依存がなく（各値は最後の算術でのみ使用）、全て1つの `Promise.all` で並列化。返却 shape・数値は不変
- [X] T009 [US1] `RecommendHeroCard` の二重配置を確認 → 新規ユーザー分岐(L44)と既存ユーザー分岐(L52)は **相互排他**で同時マウントしない。HAR の二重発火は summary `undefined→loaded` 遷移での再マウント由来のため、配置（新規=最上部 / 既存=復習の後）は UX 意図として維持し、T010 のキャッシュ共有で二重フェッチを解消
- [X] T010 [US1] `lib/hooks/useRecommendation.ts` の `staleTime: 0, refetchOnMount: 'always'` を `staleTime: 60_000`＋`refetchOnMount` 既定へ変更。再マウントでもキャッシュ再利用で二重フェッチ消滅。アルゴリズムロジックは不変
- [ ] T011 [US1] `pnpm test`(40 passed)／`pnpm lint`(clean)／`tsc --noEmit`(clean) 通過済み。**HAR 再取得（重複消失・summary 短縮の実測）はデプロイ環境が必要なため未実施** → デプロイ後に `specs/006-dashboard-perf/baseline-metrics.md` へ追記

**Checkpoint**: US1 単独でデプロイ可能（低リスクで体感改善）。summary 系の数値一致がテストで保証される

---

## Phase 4: User Story 2 - サーバ並列プリフェッチ＋ハイドレーション (Priority: P2)

**Goal**: 初回表示の直列 read Server Action 群を「認証1回＋`Promise.all` の1バッチ」に収束させ、`HydrationBoundary` でクライアントへ渡す（AC1、AC5）

**Independent Test**: HAR 再計測で初回の直列 read Server Action が消え重なりペア>0／ウォール<3秒。残り read 系指標も Vitest でゴールデンと一致

### Tests for User Story 2 (必須) ⚠️

- [ ] T012 [P] [US2] `__tests__/lib/dashboard/queries-parity.test.ts` を作成し、`queries.ts` へ純粋化した残り read 関数（trend / weakness / streak / difficulty / completionByMode / dueReviewSummary / upcomingReviewSchedule / reviewModeBreakdown）の返却がゴールデンと一致することを検証（既定フィルタ all/全国）

### Implementation for User Story 2

- [ ] T013 [P] [US2] `app/(app)/dashboard/actions.ts` の残り read 関数を `app/(app)/dashboard/queries.ts` の `userId` 引数純粋関数へ抽出（`getAccuracyTrend`/`getCompletionTrend`/`getWeaknessRanking`/`getStreak`/`getDifficultyProgress`/`getCompletionByMode`/`getDueReviewSummary`/`getUpcomingReviewSchedule`/`getReviewItemList`/`getReviewModeBreakdown`）。各 `actions.ts` 関数は薄いラッパ化（既存フックのオンデマンド取得は不変）
- [ ] T014 [P] [US2] `getRecommendation` の取得本体を `userId` 引数で呼べる形に整理（`app/(app)/quiz/municipality/actions.ts`）。プリフェッチ時は `excludeCodes: []`（履歴は client localStorage のため SSR では空）でキー一致させ、不要な再フェッチを避ける
- [ ] T015 [US2] 既定フィルタ（all/全国・既定 period）の全 read を **認証1回＋`Promise.all`** で取得し `dehydrate` するサーバ関数 `lib/dashboard/prefetch.ts` を新規作成。各クエリの `queryKey` は対応フック（`lib/hooks/use*.ts`）と完全一致させる
- [ ] T016 [US2] `app/(app)/page.tsx` を薄い server wrapper 化（`prefetch.ts` 実行 → `HydrationBoundary`）。表示本体は `components/dashboard/dashboard-client.tsx`（新規）へ client component として分離。`useState` フィルタ・各部品階層は現状維持
- [ ] T017 [US2] サーバでの `dehydrate`/`HydrationBoundary` 連携用に `app/providers.tsx` の `QueryClient` 生成を SSR セーフに調整（必要なら `getQueryClient` ヘルパ化）。`staleTime` 既定は維持
- [ ] T018 [US2] `pnpm test` / `pnpm lint` 緑を確認。HAR 再計測で「初回の直列 read 消失・重なりペア>0・ウォール<3秒」を `specs/006-dashboard-perf/baseline-metrics.md` に記録

**Checkpoint**: US1＋US2 で初回表示が並列1バッチに収束。read 系全指標の数値一致がテストで保証される

---

## Phase 5: User Story 3 - 認証往復削減＋仕上げ (Priority: P3)

**Goal**: 認証を `getClaims`（ローカル JWT 検証）優先に寄せ往復を削減し、残存 read のハイドレーション網羅と最終再計測・数値一致サインオフを行う（AC3、AC4 最終確認）

**Independent Test**: 本番で署名鍵が有効なら認証往復が初回あたり大幅減（HAR で確認）。無効環境でも `getUser` フォールバックで挙動不変

### Implementation for User Story 3

- [ ] T019 [US3] リクエスト単位の認証ヘルパ `lib/auth/current-user.ts` を新規作成。`supabase.auth.getClaims()` 優先＋未対応時 `getUser()` フォールバックで `userId` を返す（セキュリティ＝署名検証は維持）
- [ ] T020 [US3] `lib/dashboard/prefetch.ts` と各 `actions.ts` ラッパの `requireUser()` を `current-user.ts` 経由に置換し、初回プリフェッチの認証を1回に統一
- [ ] T021 [US3] 残存する初回フェッチ部品がハイドレート済みキャッシュのみ読む状態か点検し、取りこぼし read を `prefetch.ts` に追加（`components/dashboard/*`・`components/recommend/recommend-hero-card.tsx`）
- [ ] T022 [US3] research.md「未解決事項」: 本番 Supabase の非対称 JWT 署名鍵（`getClaims` ローカル検証）有効性を確認し結果を `specs/006-dashboard-perf/research.md` に追記（無効なら `getUser` 維持で本体効果は不変）

**Checkpoint**: 全 AC を満たす。認証往復削減が上積みされる

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 最終検証と整合確認

- [ ] T023 改修前後 HAR を `quickstart.md` の手順で比較し、(a)直列/並列の重なり (b)総ウォール時間 (c)リクエスト本数 を `specs/006-dashboard-perf/baseline-metrics.md` にまとめ AC1/AC5 達成を確認
- [ ] T024 主要指標（totalQuestions / coverageRate / streak / weakness / 復習件数 / 推薦提示内容）の改修前後一致を Vitest 全緑＋目視で最終確認（AC4）
- [ ] T025 [P] フィルタ変更・手動更新のオンデマンド取得が既存挙動のまま走ることを手動確認（非ゴール: フィルタ挙動不変・既定 all/全国 で開始）
- [ ] T026 `pnpm lint` / `pnpm test` 最終実行とコミット整理（Conventional Commits）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 依存なし・即着手可
- **Foundational (Phase 2)**: Setup 完了に依存。**US1/US2 のテストをブロック**（共有シード＋ゴールデン）
- **US1 (Phase 3)**: Foundational 後に着手可。単独デプロイ可能な MVP
- **US2 (Phase 4)**: Foundational 後に着手可。`queries.ts`（T003）と US1 の summary 抽出パターンを土台にするため US1 後が安全
- **US3 (Phase 5)**: US2（`prefetch.ts`）完了に依存（認証ヘルパを差し込むため）
- **Polish (Phase 6)**: 全ストーリー完了に依存

### User Story Dependencies

- **US1 (P1)**: Foundational 後・他ストーリー非依存。MVP として独立デリバリ可
- **US2 (P2)**: `queries.ts` 共有のため US1 と同じ基盤上。独立テスト可（queries-parity.test.ts）
- **US3 (P3)**: US2 の `prefetch.ts` に認証ヘルパを差し込むため US2 完了が前提

### Within Each User Story

- テスト（必須）を先に書き FAIL を確認 → 抽出/実装 → 緑化
- queries 抽出 → prefetch → page.tsx 分割 の順
- ストーリー完了→次の優先度へ

### Parallel Opportunities

- T001/T002（Setup）は並列可
- T013/T014（read 抽出と recommendation 整理）は別ファイルで並列可
- T006（US1 テスト）と T012（US2 テスト）は別ファイルで並列着手可（ただし対象実装に依存）

---

## Parallel Example: User Story 2

```bash
# 別ファイルの read 抽出を並列で:
Task: "残り read 関数を queries.ts へ純粋化 (app/(app)/dashboard/queries.ts)"
Task: "getRecommendation を userId 引数で呼べる形に整理 (app/(app)/quiz/municipality/actions.ts)"
```

---

## Implementation Strategy

### MVP First (User Story 1 のみ)

1. Phase 1 Setup
2. Phase 2 Foundational（共有シード＋ゴールデン＝AC4 の土台。最重要）
3. Phase 3 US1（重複排除＋Promise.all）
4. **STOP & VALIDATE**: HAR で約3.5秒の重複消失と summary 短縮を確認・デプロイ可

### Incremental Delivery

1. Setup + Foundational → テスト基盤完成
2. US1 → 独立検証 → デプロイ（MVP・低リスク即効）
3. US2 → 初回プリフェッチ収束 → 検証 → デプロイ（AC1/AC5 主因解消）
4. US3 → 認証往復削減＋仕上げ → 最終検証（AC3）

---

## Notes

- [P] = 別ファイル・依存なし
- data-model.md の不変条件（発行 SQL・集計ロジック・返却 shape・`serialize` 挙動を変えない）を全タスクで厳守
- テストデータは隔離投入しクリーンに戻す（memory: verify-with-tests-not-DB）
- 性能は HAR 比較で、数値一致は Vitest（必須）で検証する
- 各タスク／論理グループ単位でコミット
