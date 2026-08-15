# Tasks: 復習セッションの同日ガード条件適正化と無限ループ解消

**Feature**: 復習セッションの同日ガード条件適正化と無限ループ解消  
**Branch**: `021-fix-review-same-day-guard` | **Spec**: `specs/021-fix-review-same-day-guard/spec.md` | **Plan**: `specs/021-fix-review-same-day-guard/plan.md`

## Phase 1: Setup

- [x] T001 既存のテスト環境とブランチ状態を確認（`pnpm test` 実行）

## Phase 2: Foundational (Blocking Prerequisites)

- [x] T002 `lib/quiz/srs/scheduler.ts` の `alreadyAdvancedToday` の引数に `dueDate` を含め、期日未到来（明日以降）の場合のみ同日スキップとするよう修正
- [x] T003 `lib/quiz/srs/update.ts` の `ExistingSrs` インターフェースに `dueDate: Date` を追加し、`computeSrsUpdate` で `alreadyAdvancedToday` を正しく呼び出す

## Phase 3: User Story 1 & 2 - 復習期日超過アイテムの正解前進と重複出題ループの解消 (Priority: P1) 🎯 MVP

**Goal**: 復習クイズで期日到来中のアイテムに正解した際、同日に回答履歴があっても期日が前進し、完了後の残り件数が減算され、「続けて復習する」で消化済み問題が再出題されない。

**Independent Test**: 期日超過の復習アイテムを持つ状態で復習クイズをプレイし正解する。結果画面の残り件数が正解数分減少し、次バッチに消化済みアイテムが再出題されないことを確認。

- [x] T004 [US1] `app/(app)/quiz/municipality/actions.ts` の `upsertSrsRecord` で `existing` オブジェクト生成時に `dueDate: existing.dueDate` を渡すよう更新
- [x] T005 [US1] `__tests__/lib/quiz/srs/scheduler.test.ts` に `alreadyAdvancedToday` の期日到来中（`dueDate < JST翌日開始`）と前進済み（`dueDate >= JST翌日開始`）のテストケースを追加
- [x] T006 [US1] `__tests__/lib/quiz/srs/update.test.ts` に「同日回答履歴があっても期日到来中アイテムなら正解で前進する」回帰テストケースを追加

## Phase 4: User Story 3 - 誤答履歴に基づく早期卒業判定の正常化 (Priority: P2)

**Goal**: 過去に誤答履歴があるアイテムは早期卒業せず通常コースで進行し、過去に一度も誤答していないアイテムのみを早期卒業させる。

**Independent Test**: 誤答履歴の有無による2回目正解時の `status` が、誤答履歴ありなら `reviewing`、誤答履歴なしなら `graduated` になることを確認。

- [x] T007 [US3] `app/(app)/quiz/municipality/actions.ts` の `upsertSrsRecord` で `let everWrong = true; ... everWrong = !wrongRow;` を `everWrong = Boolean(wrongRow);` に修正
- [x] T008 [US3] `__tests__/lib/quiz/srs/update.test.ts` に誤答履歴あり/なしでの早期卒業判定の回帰テストケースを追加・拡充

## Phase 5: Polish & Verification

- [x] T009 型チェック (`npx tsc --noEmit` / `pnpm type-check`)、テスト全件 (`pnpm test`)、ESLint Ratchet (`pnpm lint:ratchet`) を実行しすべてパスすることを確認

## Dependencies

- Phase 2 (T002, T003) は Phase 3, Phase 4 の前提
- Phase 3 (T004-T006) は US1/US2 の修正
- Phase 4 (T007-T008) は US3 の修正
- Phase 5 (T009) は最終検証
