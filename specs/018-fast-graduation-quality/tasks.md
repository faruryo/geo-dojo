# Tasks: 解答時間に基づくSM-2評価（q=5）と卒業判定の高速化 (B010 Phase 2/3)

**Feature Branch**: `018-fast-graduation-quality` | **Date**: 2026-08-15 | **Plan**: [plan.md](file:///Users/faru/geo-dojo/specs/018-fast-graduation-quality/plan.md)

## Task Summary

- Total Tasks: 11
- Setup & Foundational: 3 tasks
- User Story 1 (Phase 2: Quality段階化 & EF加速): 4 tasks
- User Story 2 (Phase 3: 速答定着による早期卒業): 2 tasks
- Polish & Verification: 2 tasks

---

## Phase 1: Setup

- [x] T001 `ReviewQuality` 型定義に `5` を追加 (`2 | 4 | 5`) in `lib/quiz/srs/types.ts`

---

## Phase 2: Foundational

- [x] T002 [P] `determineReviewQuality` の単体テスト作成（正誤、10秒以内/超、境界値10,000ms、null/undefined） in `__tests__/lib/quiz/srs/quality.test.ts`
- [x] T003 `determineReviewQuality` 純粋関数の実装 in `lib/quiz/srs/quality.ts`

---

## Phase 3: User Story 1 - 速答正解による復習間隔の加速 (Priority: P1)

**Goal**: 10秒以内の正解で `quality = 5` と判定され、Ease Factor が +0.1 増加して復習間隔が加速する。

- [x] T004 [P] [US1] `applySm2` における quality=5 (EF +0.1, interval 計算) のテストケース追加 in `__tests__/lib/quiz/srs/sm2.test.ts`
- [x] T005 [P] [US1] `computeSrsUpdate` における `answerTimeMs` 引数伝搬と quality 判定のテストケース追加 in `__tests__/lib/quiz/srs/update.test.ts`
- [x] T006 [US1] `computeSrsUpdate` の引数に `answerTimeMs` を追加し、`determineReviewQuality` を呼び出して `applySm2` に渡す実装 in `lib/quiz/srs/update.ts`
- [x] T007 [US1] Server Action `saveMunicipalityQuizResult` / `upsertSrsRecord` から `computeSrsUpdate` へ `input.answerTimeMs` を引き渡す in `app/(app)/quiz/municipality/actions.ts`

---

## Phase 4: User Story 2 - 速答の定着による早期卒業 (Priority: P2)

**Goal**: 誤答歴があっても速答（quality=5）を重ねて rep>=3 && interval>=15 に達した場合に `status: 'graduated'` となる。

- [x] T008 [P] [US2] `applySm2` および `computeSrsUpdate` における速答定着早期卒業（rep>=3 && quality===5 && interval>=15）のテストケース追加 in `__tests__/lib/quiz/srs/sm2.test.ts` および `__tests__/lib/quiz/srs/update.test.ts`
- [x] T009 [US2] `applySm2` の卒業判定ロジックに速答定着条件を追加 in `lib/quiz/srs/sm2.ts`

---

## Phase 5: Polish & Validation

- [x] T010 全体テスト (`pnpm test`)、型チェック (`npx tsc --noEmit`)、Lint Ratchet (`pnpm lint:ratchet`) を実行し全パスを確認
- [x] T011 `specs/backlog.md` の B010 ステータスを更新
