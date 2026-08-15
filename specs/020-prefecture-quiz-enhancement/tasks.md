# Tasks: 都道府県クイズ強化とタイムアタックモード (B003)

**Feature Branch**: `020-prefecture-quiz-enhancement` | **Date**: 2026-08-15 | **Plan**: [plan.md](file:///Users/faru/geo-dojo/specs/020-prefecture-quiz-enhancement/plan.md)

## Task Summary

- Total Tasks: 8
- Foundational: 2 tasks
- User Story 1 (設定・出題生成): 2 tasks
- User Story 2 (タイムアタック・計測): 2 tasks
- Polish & Verification: 2 tasks

---

## Phase 1: Foundational

- [x] T001 [P] `buildPrefectureQuestions`, `formatClearTime`, `isNewBestTime` の単体テスト作成 in `__tests__/lib/quiz/prefecture-quiz.test.ts`
- [x] T002 都道府県クイズ純粋関数群の実装 in `lib/quiz/prefecture-quiz.ts`

---

## Phase 2: User Story 1 - 都道府県クイズの設定（地域・出題数・苦手優先） (Priority: P1)

**Goal**: 出題地域・出題数・苦手優先を設定してクイズを開始できる。

- [x] T003 [US1] 都道府県クイズ設定画面（地域選択、出題数ボタン、モード選択、苦手優先トグル、スタートボタン）の実装 in `app/(app)/quiz/prefecture/page.tsx`
- [x] T004 [US1] 過去の誤答データの localStorage 読み込みと `buildPrefectureQuestions` への連携 in `app/(app)/quiz/prefecture/page.tsx`

---

## Phase 3: User Story 2 - タイムアタックモードとクリアタイム計測 (Priority: P1)

**Goal**: タイムアタックモードで合計クリアタイムを計測し、自己ベストを記録・表示する。

- [x] T005 [US2] プレイ画面での経過時間タイマー表示および回答時間・合計タイムの計測ロジックの実装 in `app/(app)/quiz/prefecture/page.tsx`
- [x] T006 [US2] 結果画面でのクリアタイム表示、自己ベスト更新判定・保存およびバッジ表示の実装 in `app/(app)/quiz/prefecture/page.tsx`

---

## Phase 4: Polish & Validation

- [x] T007 全体テスト (`pnpm test`)、型チェック (`npx tsc --noEmit`)、Lint Ratchet (`pnpm lint:ratchet`) を実行し全パスを確認
- [x] T008 `specs/backlog.md` の B003 ステータスを更新
