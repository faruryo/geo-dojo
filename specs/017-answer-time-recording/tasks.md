# Tasks: 解答時間の計測と DB 保存処理の実装 (B010 Phase 1)

**Feature Branch**: `feat/b010-answer-time-recording`  
**Spec**: `/specs/017-answer-time-recording/spec.md`  

---

## Phase 1: DB スキーマ & マイグレーション

- [x] T001 `lib/db/schema.ts` の `municipalityQuizResults` 定義に `answerTimeMs: integer('answer_time_ms')` を追加する。
- [x] T002 マイグレーション SQL `supabase/migrations/0004_add_answer_time_ms.sql` を作成する。
- [x] T003 `docs/db-schema.md` の Mermaid ER図と仕様一覧に `answer_time_ms` カラムを追加・更新する。

---

## Phase 2: ロジック & バリデーション

- [x] T004 `lib/quiz/answer-time.ts` に PostgreSQL signed 32-bit integer 上限 (2,147,483,647) ガードを含む `normalizeAnswerTimeMs` を実装する。
- [x] T005 `__tests__/lib/quiz/answer-time.test.ts` に正常系および境界値・型不正・上限超過の単体テストを作成しパスすることを確認する。

---

## Phase 3: Server Action & UI 連携

- [x] T006 `app/(app)/quiz/municipality/actions.ts` の `saveMunicipalityQuizResult` および `upsertSrsRecord` のパラメータ型に `answerTimeMs` を追加し、`normalizeAnswerTimeMs` 経由で DB へ保存する。
- [x] T007 `components/quiz/quiz-runner.tsx` に出題表示開始時刻の記録ロジックを追加し、問題確定時に経過時間を計測して `saveMunicipalityQuizResult` に渡す。

---

## Phase 4: 品質検証

- [x] T008 `pnpm type-check` で型アサーション・型エラーがないことを確認する。
- [x] T009 `pnpm test` で既存および新規テストが全て通過することを確認する。
- [x] T010 `pnpm lint` / `pnpm lint:ratchet` でエラーがないことを確認する。
