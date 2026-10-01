# Tasks: 復習完了時のSRS進捗・定着可視化

**Feature**: `030-review-outcome-feedback`  
**Date**: 2026-10-02  
**Spec**: [spec.md](./spec.md) / **Plan**: [plan.md](./plan.md) / **Data model**: [data-model.md](./data-model.md)

---

## Phase 1: Foundational（純粋関数・全ストーリー共通）

**⚠️ CRITICAL**: UI 統合の前に本フェーズのテストがすべて通っていること

- [x] T001 [P] `lib/quiz/srs/simulation.ts` を新設し、`MAX_SIMULATION_STEPS = 20` と `simulateStepsToGraduation(state, everWrong)` を実装（`applySm2(state, 4)` の反復 + 早期卒業判定、上限で `null`）
- [x] T002 [P] `__tests__/lib/quiz/srs/simulation.test.ts`: 誤答歴なし rep0/rep1、誤答直後（EF 2.18 → 5回）、回答後 rep2 int6 EF 2.18（→3回）、回答後 rep3 int13 EF 2.18（→2回。spec 受入シナリオ US1-2 の「あと2回」に対応）、EF 1.3 下限、NaN で `null` のケース表。回帰テストとして、早期卒業判定を外すと赤くなることを確認する
- [x] T003 [P] `lib/quiz/srs/snapshot.ts` を新設し、`SrsSnapshotKey` / `SrsSnapshotRecord` / `SrsSnapshotEntry` 型、`MAX_SNAPSHOT_KEYS = 100`、`validateSrsSnapshotKeys(input)` を実装（[contracts/srs-snapshot-action.md](./contracts/srs-snapshot-action.md)）
- [x] T004 [P] `__tests__/lib/quiz/srs/snapshot.test.ts`: 空・非配列・101件・不正モード・不正コード・重複畳み込み・100件ちょうどの境界
- [x] T005 `lib/quiz/quiz-session-core.ts` に `QuestionSaveMeta` 型と `toQuestionSaveMeta(entries, questionIndex, persisted)` を追加
- [x] T006 `lib/quiz/srs/outcome.ts` を新設し、`questionSaveTargets` / `questionSrsKeys`、`isSaveMetaConsistent`、`persistedSrsKeys`、`resolveOutcomeLabel`、`buildReviewOutcome`、`formatOutcomeLabel`、`formatRemainingSteps` を実装（data-model の判定表に準拠）
- [x] T007 `__tests__/lib/quiz/srs/outcome.test.ts`: 7ラベルの判定表、JST 暦日境界（今日/明日/N日後）、Mode A 片県卒業 → 復習継続、保存失敗の隔離、サマリ合計 = 問題数、整合ガード（件数・番号範囲・重複・コード集合不一致）、`post` 欠落で `null`、政令市（同県複数コード）が1行に畳まれること

**Checkpoint**: `pnpm test -- __tests__/lib/quiz/srs` が通る

---

## Phase 2: User Story 1 + 2 — 問題ごとの成果とサマリ (P1) 🎯 MVP

- [x] T008 `app/(app)/quiz/review/actions.ts` に `getSrsSnapshot(keys)` を追加（`requireUserId`、`validateSrsSnapshotKeys`、`srs_records` と誤答歴の2クエリ、失敗ログ後に再 throw）
- [x] T009 `components/quiz/use-quiz-actions.ts`: `recordAndAdvance` で `toQuestionSaveMeta` を生成して ref に蓄積し、`triggerAdvance(results, meta)` で渡す（スキップ経路も同じ ref を使う）
- [x] T010 `components/quiz/use-quiz-state.ts` / `use-quiz-session.ts` / `quiz-runner.tsx`: `onComplete(results, meta?)` に型を拡張し、`advanceQuestion(results, meta)` から受け渡す
- [x] T011 `__tests__/components/quiz/use-quiz-actions-advance.test.tsx`: 2問を回答して完了したとき、`onComplete` の第2引数に問題順の `QuestionSaveMeta` が入ること、保存失敗時に `persisted: false` になること
- [x] T012 [P] `components/quiz/quiz-result-card.tsx` に `footer?: React.ReactNode` を追加し、`actions` の後に描画する
- [x] T013 [P] `components/quiz/review-outcome-section.tsx` を新設し、`ReviewOutcomeSummary`（スケルトン対応）と `ReviewOutcomeDetails`（`<details>` アコーディオン、Mode A 多県は県別サブ行）を実装（[contracts/review-outcome-ui.md](./contracts/review-outcome-ui.md)）
- [x] T014 `app/(app)/quiz/review/page.tsx`: 出題前スナップショット（失敗時は成果なしで開始）、完了時の整合ガード → 回答後取得 → `buildReviewOutcome`、バッチ ID による古い応答の破棄、スロット割り当て（loading / ready / unavailable）

**Checkpoint**: ローカルで復習を完了するとサマリと詳細が表示され、件数の合計が分母と一致する

---

## Phase 3: User Story 3 + 4 — Mode A 県別表示とフォールバック (P2)

- [x] T015 `ReviewOutcomeDetails` で Mode A 多県問題を県ごとのサブ行に分けて表示する（T013 に含めて実装し、ここで 375px 表示を確認する）
- [x] T016 フォールバック経路の確認: 回答前取得失敗、回答後取得失敗、メタ不整合、100件超過のそれぞれで従来表示になる（T007 の純粋関数テスト + T021 の自動テスト）
- [ ] T016a quickstart の手順でフォールバック表示と 375px 表示をローカルスタックで手動確認する（Preview は本番 DB 共有のため使わない）

---

## Phase 4: Polish & 同期

- [x] T017 [P] `.design-sync/entry.tsx` に `ReviewOutcomeSummary` / `ReviewOutcomeDetails` を export し、`config.json` の `componentSrcMap` / `dtsPropsFor`（`QuizResultCard.footer` を含む）/ `overrides` を更新
- [x] T018 [P] `.design-sync/previews/ReviewOutcomeSummary.tsx` / `ReviewOutcomeDetails.tsx` を新設し、`QuizResultCard.tsx` に footer バリアントを追加
- [ ] T018a `node .design-sync/build-css.mjs` を実行する（この作業環境には gitignore 対象の `.ds-sync/` Tailwind CLI が無く未実施。Claude Design 再同期の前に実行する）
- [x] T019 [P] `AGENTS.md` の SPECKIT ポインタを 030 に更新し、復習成果の不変条件（3か所のコード集合一致・1問1件サマリ・read-only スナップショット）を追記
- [x] T020 `pnpm type-check`、`pnpm lint:ratchet`、`pnpm test` がすべて通る

---

## Phase 5: 独立監査の差し戻し対応

監査で、復習ページの非同期の流れ（FR-001 / FR-008 / FR-009）が `page.tsx` のモジュール内に閉じていて回帰テストが無いと指摘された。

- [x] T021 回答前取得 → 完了時の整合ガード → 回答後取得 → 古い応答の破棄を `lib/quiz/srs/review-outcome-flow.ts`（取得関数を注入）へ切り出し、`page.tsx` はその呼び出しだけにする。`__tests__/lib/quiz/srs/review-outcome-flow.test.ts` で、startBatch が回答前取得の完了まで解決しないこと、回答前取得失敗・回答後取得失敗・メタ欠落・100件超過・startBatch 前の complete で unavailable になること、reset 後に返った前バッチの応答を反映しないこと、回答後は保存成功分のキーだけを取得することをケース表で検証する。古い応答のガード・取得の await・件数上限・保存成功分の絞り込みを外すと赤くなることを確認済み
- [x] T022 `__tests__/server/srs-snapshot-action.test.ts`: `getSrsSnapshot` の (コード, モード) 突き合わせと入力順、両クエリの本人 `user_id` スコープ、未認証・不正入力で DB に触れないこと、DB 失敗時のログ後の再 throw。本人スコープ条件を外す・突き合わせキーを壊すと赤くなることを確認済み

---

## Dependencies

- T001・T003・T005 → T006 → T007
- T005 → T009 → T010 → T011
- T003 → T008
- T006・T008・T010・T012・T013 → T014
- T012・T013 → T017・T018
