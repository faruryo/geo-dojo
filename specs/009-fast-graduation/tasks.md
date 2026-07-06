# Tasks: 誤答なし市区町村の早期卒業

**Input**: Design documents from `/specs/009-fast-graduation/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/srs-update.md, quickstart.md

**Tests**: FR-007（判定ロジックは自動テストで検証可能であること）により、純粋関数のテストタスクを含む（プロジェクト方針: 純粋関数＋Vitest）。

**Organization**: ユーザーストーリー単位。US1（回答時の早期卒業）が MVP、US2（一括バックフィル）は独立して実装・検証可能。

## Phase 1: Setup

セットアップ不要（既存プロジェクトへの変更のみ。新規依存・スキーマ変更なし）。

## Phase 2: Foundational

ブロッキング前提なし（US1 が最初の実装単位）。

## Phase 3: User Story 1 - 誤答なしなら2回連続正解で即卒業 (Priority: P1) 🎯 MVP

**Goal**: 誤答履歴のない市区町村×モードは、別日2回目の正解で `status='graduated'` になる。

**Independent Test**: `pnpm test` の純粋関数テスト＋ローカルで別日2回正解 → 「覚えている途中」一覧から消えることを確認（quickstart.md 参照）。

- [x] T001 [US1] `__tests__/lib/quiz/srs/update.test.ts` に早期卒業テストを追加（contracts/srs-update.md の事後条件 1〜5 を網羅: ①everWrong=false・新rep=2 で graduated ②everWrong=false・新rep=1（新規初回）は reviewing ③everWrong=true・rep=2 は reviewing（通常コース維持） ④不正解はeverWrong に関係なくリセット ⑤同日ガード skip 不変 ⑥graduated から誤答で reviewing 復帰。既存テストは第4引数追加に合わせて更新）
- [x] T002 [US1] `lib/quiz/srs/update.ts` の `computeSrsUpdate` に第4引数 `everWrong: boolean` を追加し、正解経路で `!everWrong && result.repetition >= 2` のとき `status: 'graduated'` に上書き（easeFactor / interval / dueDate は SM-2 計算値のまま。`sm2.ts` は変更しない）。T001 のテストが全て通ること
- [x] T003 [US1] `app/(app)/quiz/municipality/actions.ts` の `upsertSrsRecord` で、正解時のみ `municipality_quiz_results` の誤答行 EXISTS（userId, municipalityCode, mode, isCorrect=false）を照会して `everWrong` を渡す。不正解時は照会せず `true` を渡す
- [x] T004 [US1] `pnpm test` と `pnpm lint` を実行し全て通ることを確認

**Checkpoint**: US1 単体でデプロイ可能（新規回答から早期卒業が効き始める）。

## Phase 4: User Story 2 - 既存レコードの一括卒業 (Priority: P2)

**Goal**: 「誤答なし・正解2回以上・reviewing」の既存レコードを冪等スクリプトで一括 graduated 化。

**Independent Test**: ローカル Supabase に対して実行し、対象件数の減少と再実行時の冪等性を確認。

- [x] T005 [US2] `scripts/backfill-early-graduation.ts` を新規作成: `DATABASE_URL` で接続し、`status='reviewing' AND repetition>=2` かつ `municipality_quiz_results` に誤答行のない `srs_records` を `status='graduated'` に UPDATE。対象件数・更新件数を stdout 出力。DELETE/INSERT なし・冪等（既存 `scripts/` の drizzle/postgres-js 接続パターンに合わせる）
- [ ] T006 [US2] ローカル Supabase でバックフィルを2回実行し、1回目で該当件数が更新され2回目は更新0件（冪等）であることを確認（`supabase start` → quickstart.md の手順）※未実施: Docker Desktop がセッションから起動できず。Docker 起動後に手動実行

**Checkpoint**: 本番実行の準備完了（実行自体はデプロイ後の運用作業）。

## Phase 5: Polish & Cross-Cutting Concerns

- [ ] T007 quickstart.md の動作確認手順を実施（ローカルで別日2回正解 → 一覧から消える、SC-001）し、`pnpm lint` / `pnpm test` の最終確認

## Dependencies & Execution Order

- US1（T001→T002→T003→T004、TDD順）→ US2（T005→T006）は独立だが、判定述語を揃えるため US1 の関数確定後に US2 を実装するのが安全
- [P] なし（変更ファイルが少なく直列で十分）

## Implementation Strategy

- MVP = US1（Phase 3）のみで新規分の価値が出る
- US2 は同一述語の SQL 化。US1 のテスト済みロジックを正として実装
- 本番バックフィルはマージ・デプロイ後に運用者が手動実行（quickstart.md）
