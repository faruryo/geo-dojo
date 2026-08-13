# Implementation Plan: 解答時間の計測と DB 保存処理の実装 (B010 Phase 1)

**Feature ID**: `017-answer-time-recording`  
**Prerequisites**: `lib/db/schema.ts`, `app/(app)/quiz/municipality/actions.ts`, `components/quiz/quiz-runner.tsx`  

---

## 1. アーキテクチャ概要 (Architecture Overview)

### データフロー
1. **フロントエンド (`QuizRunner`)**:
   - 各問題の切り替え時（`qIdx` 変化時）に `questionStartTimeRef.current = Date.now()` を記録
   - 解答（Mode A submit / Mode B, C choice / Mode D tap / timeout）確定時に `Math.max(0, Date.now() - questionStartTimeRef.current)` を計算
   - `recordAndAdvance` 経由で Server Action `saveMunicipalityQuizResult` へ `answerTimeMs` を渡す

2. **サーバーハンドラ (`saveMunicipalityQuizResult`)**:
   - `normalizeAnswerTimeMs` ヘルパーにより `0 <= input <= 2,147,483,647` をチェック
   - PostgreSQL integer 型上限超過や NaN / 負数を防御的に `null` 化
   - `municipality_quiz_results` へ INSERT

3. **データベース層**:
   - `lib/db/schema.ts` の `municipalityQuizResults` テーブルに `answerTimeMs: integer('answer_time_ms')` を追加
   - マイグレーション SQL `supabase/migrations/0004_add_answer_time_ms.sql`
   - ドキュメント `docs/db-schema.md` の更新

---

## 2. 変更コンポーネント一覧

- `lib/db/schema.ts`: `answerTimeMs` カラムの追加
- `supabase/migrations/0004_add_answer_time_ms.sql`: DDL マイグレーション
- `lib/quiz/answer-time.ts`: `normalizeAnswerTimeMs` の純粋関数
- `__tests__/lib/quiz/answer-time.test.ts`: 単体テスト
- `app/(app)/quiz/municipality/actions.ts`: `saveMunicipalityQuizResult` と `upsertSrsRecord` の引数拡張
- `components/quiz/quiz-runner.tsx`: 表示時刻計測と Server Action 送信
- `docs/db-schema.md`: スキーマ仕様書の更新
