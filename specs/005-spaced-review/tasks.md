---
description: "Task list for 科学的間隔反復による間違い復習"
---

# Tasks: 科学的間隔反復による間違い復習

**Input**: Design documents from `/specs/005-spaced-review/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/server-actions.md, quickstart.md

**Tests**: plan.md (research R8) で SM-2 純粋ロジックのみ Vitest 単体テストを行うと決定済み。該当タスクを Phase 2 に含む。DB/Server Action/UI は quickstart の手動検証。

**Organization**: User Story 単位でフェーズ分割。各ストーリーは独立してテスト可能。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並列実行可（別ファイル・未完了タスクへの依存なし）
- **[Story]**: US1/US2/US3（spec.md のユーザーストーリー）
- ファイルパスは正確に記載

## Path Conventions

Next.js 単一プロジェクト（リポジトリルート）。純粋ロジック=`lib/quiz/srs/`、副作用=`app/(app)/**/actions.ts`、UI=`app/(app)/`・`components/`。

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: テスト基盤とロジック配置の初期化

- [x] T001 `package.json` に Vitest を導入（devDeps: `vitest`）し、`"test": "vitest run"` / `"test:watch": "vitest"` script を追加。リポジトリルートに `vitest.config.ts` を作成（`environment: 'node'`, `include: ['__tests__/**/*.test.ts']`）
- [x] T002 [P] `lib/quiz/srs/` ディレクトリを作成し `lib/quiz/srs/types.ts` を新規作成（`ReviewQuality = 2 | 4`, `SrsState`, `SrsUpdateResult`, `SrsStatus` を data-model.md に従い定義）

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 全ストーリーが依存する SRS の状態管理基盤（スキーマ・SM-2 ロジック・回答捕捉・バックフィル）。

**⚠️ CRITICAL**: このフェーズ完了まで US1/US2/US3 は着手不可

### スキーマ & マイグレーション

- [x] T003 `lib/db/schema.ts` に `srsRecords` テーブルを追加（data-model.md の Drizzle 定義どおり: 列・`srs_user_due_idx (user_id, due_date)`・`srs_user_code_mode_uidx (user_id, municipality_code, mode)`・`srs_user_status_idx`）。`SrsRecord`/`NewSrsRecord`/`SrsStatus` 型もエクスポート
- [x] T004 `pnpm drizzle-kit generate` を実行し `supabase/migrations/0001_*.sql` を生成。生成 SQL に (a) `srs_records` の RLS 有効化＋`user_id = auth.uid()` の SELECT/INSERT/UPDATE/DELETE ポリシー、(b) 既存誤答ログからのバックフィル `INSERT INTO srs_records (...) SELECT ... FROM municipality_quiz_results GROUP BY user_id, municipality_code, mode HAVING SUM(CASE WHEN NOT is_correct THEN 1 ELSE 0 END) > 0 ... ON CONFLICT (user_id, municipality_code, mode) DO NOTHING`（due=now, status='reviewing', name/prefecture は最新ログ）を手動追記（data-model.md「マイグレーション」節）
- [ ] T005 ローカルで `pnpm drizzle-kit push` ← 手動実行が必要（または migration 適用）を実行し、`srs_records` 作成・インデックス・RLS・バックフィルが反映されることを確認

### SM-2 純粋ロジック（+ 単体テスト）

- [x] T006 [P] `lib/quiz/srs/sm2.ts` を新規作成。`applySm2(state, quality): SrsUpdateResult` を実装（research R1: q=4 で EF 不変・interval 1→6→round(prev*EF)、q=2 で rep=0/interval=1/EF=max(1.3, EF-0.32)、`dueInDays` 算出）
- [x] T007 [P] `lib/quiz/srs/scheduler.ts` を新規作成。`isDue(dueDate, now)`, `shouldGraduate(interval, repetition)`（interval>=30 && rep>=4, research R2）, `alreadyAdvancedToday(lastReviewedAt, now)`（`lib/utils/date-jst.ts` の `formatJSTDate`/`getJSTToday` を再利用, research R3）を実装
- [x] T008 [P] `__tests__/lib/quiz/srs/sm2.test.ts` を作成し `applySm2` を検証（正解連続の interval 拡大、不正解リセット、EF 下限1.3クランプ、q=4でEF不変）
- [x] T009 [P] `__tests__/lib/quiz/srs/scheduler.test.ts` を作成し `isDue` 境界（due==now を含む）・`shouldGraduate`・`alreadyAdvancedToday`（JST 同日）を検証

### 回答捕捉への SM-2 統合（全クイズ共通）

- [x] T010 `app/(app)/quiz/municipality/actions.ts` の `saveMunicipalityQuizResult` を拡張
- [x] T010a SM-2 更新の判定ロジックを純粋関数 `lib/quiz/srs/update.ts`（`computeSrsUpdate`）に抽出し、server action はそれを呼ぶ薄いラッパに。`__tests__/lib/quiz/srs/update.test.ts` で新規/同日ガード/連続正解/卒業/復帰を網羅（DB不要で挙動を保証）
- [x] T010b 【B007修正】Mode A の記録を都道府県ごと代表1件に畳む（政令市の区による多重カウント防止）。`dedupeInstancesByPrefecture`（`lib/quiz/municipality-data.ts`）+ `QuizRunner.handleModeASubmit` 適用 + `__tests__/lib/quiz/mode-a-dedupe.test.ts`。SRS件数・統計の正確性を確保（contracts/server-actions.md）: 既存ログ INSERT に加え、`(userId, code, mode)` の `srs_records` を取得→`applySm2`/`scheduler` 適用→upsert（`ON CONFLICT (user_id, municipality_code, mode)`、`lastReviewedAt=now`）。不正解=常にリセット/復帰（graduated→reviewing 含む, FR-019）、正解=同日未前進なら前進・`shouldGraduate` で status='graduated'、同日前進済みはログのみ（R3）

**Checkpoint**: SRS 基盤完成（schema/migration/SM-2/捕捉）。回答するたび `srs_records` が更新される状態。各ストーリーは並行着手可能。

---

## Phase 3: User Story 1 - 期日が来た間違いを復習する (Priority: P1) 🎯 MVP

**Goal**: 期日到来の (市区町村×モード) のみを **モード混在**で出題し、回答で SM-2 再スケジュールされる復習セッションを提供する。

**Independent Test**: 通常クイズで数問誤答 → `/quiz/review` で期日到来分のみ（モード混在）出題 → 正解で次回 due が延び、誤答で翌日 due になることを確認（quickstart S1/S2）。

### 出題対象取得（Server Action）

- [x] T011 [US1] `app/(app)/quiz/review/actions.ts` を新規作成し `getDueReviewItems(opts?)` を実装（contracts: `status='reviewing' AND due_date<=now()` を `due_date ASC, interval ASC` で `limit`(既定20)件、期日未到来は返さない／FR-009,010,012b,SC-006,SC-008）

### 進行UIの抽出（QuizRunner）

- [x] T012 [US1] `app/(app)/quiz/municipality/[mode]/page.tsx` の playing フェーズ（A/B/C/D 描画・各回答ハンドラ・`recordAndAdvance`・フィードバック・進捗表示）を `components/quiz/quiz-runner.tsx`（新規 client component, props: `questions: Question[]`, `onComplete`）へ抽出。`Question` 型・各モードUI（`JapanMap`/`MunicipalityMap` 含む）を移植し、混在 `Question[]` でも問題ごとにモードUIを切替できるようにする（FR-012a）
- [x] T013 [US1] `app/(app)/quiz/municipality/[mode]/page.tsx` をリファクタし、setup フェーズで単一モードの `Question[]` を生成して `QuizRunner` を使う形へ変更（既存挙動を維持。`buildQuestions` は流用）

### 復習セッション画面

- [x] T014 [US1] `app/(app)/quiz/review/page.tsx` を新規作成: `getDueReviewItems()` の結果＋市区町村データセット＋distractor 生成で **モード混在 `Question[]`** を構築（出題順は取得順=優先度順のまま, FR-012b）。Mode A の due コードは name でグルーピングして `ModeAQuestion` 化（research R6）。`QuizRunner` に渡して出題し、各回答で `saveMunicipalityQuizResult` を呼ぶ（FR-011a / SM-2 更新は T010 経由）。同一 (code,mode) を同一セッションで重複させない（FR-011）
- [x] T015 [US1] 復習セッション完了時の結果表示と、due 0 件で直接開始された場合のフォールバック（完了画面 or ダッシュボードへ）を `app/(app)/quiz/review/page.tsx` に実装

**Checkpoint**: US1 単体で動作 — 間違い→期日到来→モード混在復習→再スケジュールが成立（MVP）。

---

## Phase 4: User Story 2 - ダッシュボードから今日の復習量を把握して着手する (Priority: P2)

**Goal**: ダッシュボードの「復習おすすめ」を期日駆動の「今日の復習 N件」カードへ置換し、ワンタップで `/quiz/review` に入れる。

**Independent Test**: 期日到来分を複数用意 → ダッシュボードに正しい件数バッジ＋開始ボタン、押すと期日到来分のみのセッション開始。0件時は「今日の復習なし」＋次回予定日（quickstart S5）。

- [x] T016 [US2] `app/(app)/dashboard/actions.ts` に `getDueReviewSummary()` を実装（contracts: `dueCount`/`reviewingCount`/`graduatedCount`/`nextDueAt` を `srs_records` から集計／FR-013,015,016）
- [x] T017 [P] [US2] `lib/hooks/useDueReviewSummary.ts` を新規作成（TanStack Query で `getDueReviewSummary` をラップ、既存フックの作法に合わせる）
- [x] T018 [US2] `components/dashboard/review-recommendations.tsx` を「今日の復習 N件」カードへ改修: `useDueReviewSummary` を参照し、N>0 で `/quiz/review` 開始ボタン、N=0 で「今日の復習なし」＋`nextDueAt` 案内（FR-013,014,015 / SC-001 の3タップ以内）。旧 `weakness=true` 遷移を `/quiz/review` へ変更
- [x] T019 [US2] `app/(app)/dashboard/actions.ts` の旧 `getReviewRecommendations`（誤答×7日経過ロジック）を撤去し、参照箇所（`components/dashboard/review-recommendations.tsx`、`lib/hooks/useReviewRecommendations.ts` 等）を新サマリへ置換／削除（spec Assumptions「入口」: 旧ロジックを期日ベースへ置換）

**Checkpoint**: US1 + US2 が独立して動作。ダッシュボードから期日駆動で復習に入れる。

---

## Phase 5: User Story 3 - 復習の進捗と定着度を確認する (Priority: P3)

**Goal**: 復習中／定着済み件数・今後の復習予定を可視化する。

**Independent Test**: 異なる定着段階の対象を用意 → 進捗表示の「復習中／定着済み」件数・今後7日の日別予定が実データと一致（quickstart S4 の卒業含む）。

- [x] T020 [US3] `app/(app)/dashboard/actions.ts` に `getUpcomingReviewSchedule(days=7)` を実装（contracts: 今後 days 日の日別 due 件数 `Array<{date,count}>`／FR-016）
- [x] T021 [P] [US3] `lib/hooks/useUpcomingReviewSchedule.ts` を新規作成（TanStack Query ラッパー）
- [x] T022 [US3] `components/dashboard/review-progress.tsx` を新規作成: `useDueReviewSummary`（reviewing/graduated 件数）＋`useUpcomingReviewSchedule`（今後7日）を表示（FR-016 / US3 受け入れ）
- [x] T023 [US3] `app/(app)/page.tsx` のダッシュボードに `ReviewProgress` カードを配置（既存カード並びに統合、375px/ダークモード踏襲）
- [x] T023a [US3] 「覚えている途中のアイテム一覧」を追加（FR-016a）: `getReviewItemList` server action + `useReviewItemList` フック（答え＝都道府県は伏せる）
- [x] T023b [US3] 一覧を専用ページに分離（FR-016b）: ダッシュボード `ReviewProgress` は件数＋導線リンクのみ。全件は `app/(app)/quiz/review/items/page.tsx`
- [x] T023c [US3] 一覧ページに**サーバーサイドページング**（`getReviewItemList` を limit/offset/total 対応）＋**モードフィルタ**を実装（FR-016b）
- [x] T023d [US3] 一覧ページ先頭に**モード別サマリ表**（A/B/C/D × 復習中/定着済み/定着率）を追加: `getReviewModeBreakdown` + `useReviewModeBreakdown`（FR-016c）

**Checkpoint**: US1〜US3 すべて独立して機能。

---

## Phase 5b: Dashboard UX — 復習優先表示 & 復習→おすすめクイズ誘導

**Goal**: ダッシュボードで「今日の復習」を「今日のおすすめクイズ」より先に表示し（FR-020）、復習完了後に ✨ 今日のおすすめクイズへシームレスに誘導する（FR-021）。復習セッション完了時にダッシュボードの件数キャッシュを無効化し（FR-022）、レコメンドエンジンの多様性を確保する（FR-023）。

**Independent Test**: 期日到来分がある状態でダッシュボードを開き「今日の復習」セクションが「今日のおすすめクイズ」より上に表示されることを確認。dueCount=0 になると RecommendHeroCard が直下で次のアクションとして浮かび上がることを確認。復習セッション完了後の結果画面に「✨ 今日のおすすめクイズを試す」ボタンが表示され、タップでシートが開くことを確認。ダッシュボードへ戻った際に件数が即座に更新されることを確認。

- [x] T028 [US2] `app/(app)/page.tsx` のレイアウトを変更: (a) `RecommendHeroCard` を `totalQuestions === 0` 分岐の中に移動（新規ユーザー向け先頭 CTA として保持）, (b) `{summary && summary.totalQuestions > 0}` ガード内の先頭に `ReviewRecommendations` を移動し「今日の復習 > 今日のおすすめクイズ」の優先順を実現, (c) `ReviewRecommendations` の直後に `RecommendHeroCard` を配置（contracts/dashboard-ux.md §1 / FR-020）
- [x] T029 [US1] `app/(app)/quiz/review/page.tsx` の `phase === 'result'` セクションに「✨ 今日のおすすめクイズを試す」ボタンを追加（`href="/?recommend=open"`, primary）。既存の「ダッシュボードへ」ボタンは secondary/outline に格下げ（contracts/dashboard-ux.md §3 / FR-021）
- [x] T030 [P] [US2] `app/(app)/quiz/review/page.tsx` の `onComplete` ハンドラで `queryClient.invalidateQueries({ queryKey: ['dashboard', 'srs-summary'] })` を実行し、復習完了時にダッシュボードの件数キャッシュを即座に無効化する（FR-022 SHOULD / `useQueryClient` import 追加）
- [x] T031 [P] `lib/quiz/recommendation/engine.ts` を修正し、未試行モード（A/B/C/D）・未試行地域が存在する場合に優先的に推薦へ含める。`lib/quiz/recommendation/rationale.ts` に `isNovelMode`・`novelRegion` フラグを追加し適切な rationale テキストを返す。exploration pool の shuffle 漏れも修正（FR-023 SHOULD）

**Checkpoint**: 復習 → ダッシュボード → おすすめクイズの自然なフローが成立。未試行コンテンツが定期的に推薦に現れる。

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 横断的な仕上げと検証

- [x] T024 [P] `pnpm lint`（型チェック/Lint）を通す。抽出・改修で生じた未使用 import / 型エラーを解消
- [x] T025 [P] `pnpm test` を実行し SM-2/scheduler 単体テストが緑であることを確認
- [ ] T026 quickstart.md の手動シナリオ S1〜S6 を実施し受け入れチェックを完了（混在セッション SC-007、データ分離 SC-004、同日ガード R3、卒業/復帰 R2、FR-020 優先順、FR-021 CTA、FR-022 キャッシュ即時反映、FR-023 未試行モード出現を含む）
- [x] T027 [P] `specs/backlog.md` の B002 を「005 で SM-2 として着手済み」に更新（旧 Leitner 想定の記載を整理）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 依存なし、即着手可
- **Foundational (Phase 2)**: Setup 完了後。**全ユーザーストーリーをブロック**
- **User Stories (Phase 3-5)**: Foundational 完了後。US1→US2→US3 の優先順、または並行可
- **Polish (Phase 6)**: 対象ストーリー完了後

### User Story Dependencies

- **US1 (P1)**: Foundational 後に着手可。他ストーリー非依存（MVP）
- **US2 (P2)**: Foundational 後に着手可。`/quiz/review`（US1 の T014）への導線を張るが、カード単体（件数表示・空状態）は US1 未完でも独立テスト可
- **US3 (P3)**: Foundational 後に着手可。`getDueReviewSummary`（US2 の T016）を流用するため、US2 を先行させると効率的（未着手なら T016 を US3 内で先行実装）

### Within Each User Story

- T011（取得）と T012（QuizRunner 抽出）は並行可。T013/T014 は T012 完了後
- T014 は T011 + T012 完了後
- US2: T016 → T017 → T018。T019 は T018 完了後
- US3: T020 → T021 → T022 → T023

### Parallel Opportunities

- Phase 1: T002 は T001 と並行可
- Phase 2: T006/T007/T008/T009 は相互に並行可（別ファイル）。ただし T010 は T006/T007 完了後
- Phase 3: T011 と T012 を並行
- ストーリー間: Foundational 完了後、US1/US2/US3 を別担当で並行可（T016 を US2 が先に実装する前提）

---

## Parallel Example: Phase 2 Foundational

```bash
# SM-2 純粋ロジックとテストを並行実装（別ファイル）:
Task: "lib/quiz/srs/sm2.ts に applySm2 を実装"
Task: "lib/quiz/srs/scheduler.ts に isDue/shouldGraduate/alreadyAdvancedToday を実装"
Task: "__tests__/lib/quiz/srs/sm2.test.ts を作成"
Task: "__tests__/lib/quiz/srs/scheduler.test.ts を作成"
```

---

## Implementation Strategy

### MVP First (User Story 1 のみ)

1. Phase 1 Setup → 2. Phase 2 Foundational（最重要・全ブロック）→ 3. Phase 3 US1
4. **STOP & VALIDATE**: quickstart S1/S2 で US1 を独立検証 → デモ可能

### Incremental Delivery

1. Setup + Foundational → 基盤完成（回答で `srs_records` が育つ）
2. + US1 → モード混在復習が動く（MVP）
3. + US2 → ダッシュボード導線・件数・空状態
4. + US3 → 進捗・定着度の可視化
5. Polish → lint/test/quickstart/backlog 整理

---

## Notes

- [P] = 別ファイル・依存なし
- T012（QuizRunner 抽出）は本機能で最もリスクの高いリファクタ。既存 `[mode]/page.tsx` の挙動を壊さないよう、抽出後に通常クイズ（A/B/C/D）の回帰確認を行う
- SM-2 の質は二値固定（正解=4/不正解=2）。回答時間・ヒント補正なし（ヒント機能は存在しない）
- 復習回答も `municipality_quiz_results` に記録され既存指標へ反映（FR-011a）
- 各タスクまたは論理単位ごとにコミット推奨
