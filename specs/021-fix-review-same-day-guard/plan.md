# Implementation Plan: 復習セッションの同日ガード条件適正化と無限ループ解消

**Branch**: `021-fix-review-same-day-guard` | **Spec**: `specs/021-fix-review-same-day-guard/spec.md`

## Summary

復習クイズを完了した際に「続けて復習する」ボタンの件数が減らず、全く同じ問題が繰り返し出題される無限ループ不具合を解消する。
主因である `computeSrsUpdate` / `alreadyAdvancedToday` の同日ガード判定を適正化し（期日到来中のアイテムは同日回答履歴があっても正解で期日前進）、あわせて `upsertSrsRecord` 内の誤答履歴（`everWrong`）判定の論理反転を修正する。

## Technical Context

- **Language / Runtime**: Next.js 15.2.6 (App Router, React 19), TypeScript strict
- **Database / ORM**: Supabase PostgreSQL, Drizzle ORM
- **Affected Core Files**:
  - `lib/quiz/srs/update.ts`: `ExistingSrs` 型定義への `dueDate` 追加、`computeSrsUpdate` での判定
  - `lib/quiz/srs/scheduler.ts`: `alreadyAdvancedToday` の引数・判定ロジック適正化
  - `app/(app)/quiz/municipality/actions.ts`: `upsertSrsRecord` で `existing.dueDate` を渡し、`everWrong` の真偽値反転を修正
  - `__tests__/lib/quiz/srs/update.test.ts`, `__tests__/lib/quiz/srs/scheduler.test.ts`: 回帰テストの追加・更新

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. セキュリティ & コンプライアンス | ✅ PASS | 新規外部キーなし、認証・RLSに変更なし |
| II. アーキテクチャ & パフォーマンス | ✅ PASS | 判断とI/Oを分離したpure関数で判定、既存インデックス・クエリを活用 |
| III. ロジック & UI | ✅ PASS | 復習完了後の件数減算と次バッチ出題の正常化（375px・ダークモードUI維持） |

## Implementation Strategy

1. **`lib/quiz/srs/scheduler.ts` の `alreadyAdvancedToday` を適正化**:
   - `alreadyAdvancedToday(existing: { lastReviewedAt: Date | null; dueDate: Date }, now: Date): boolean`
   - スキップ条件: `lastReviewedAt` が今日（JST同日）かつ `dueDate >= getJSTStartOfTomorrow(now)`（＝すでに正解して期日が明日以降に前進済み）。
   - `dueDate < getJSTStartOfTomorrow(now)`（期日到来中）の場合は `false` を返し、前進を許可する。
2. **`lib/quiz/srs/update.ts` の `ExistingSrs` および `computeSrsUpdate` を更新**:
   - `ExistingSrs` に `dueDate: Date` を追加。
   - `alreadyAdvancedToday(existing, now)` で呼び出す。
3. **`app/(app)/quiz/municipality/actions.ts` の `upsertSrsRecord` を修正**:
   - `existing` オブジェクト生成時に `dueDate: existing.dueDate` を渡す。
   - `everWrong = !wrongRow` の論理反転を `everWrong = Boolean(wrongRow)`（または `!!wrongRow`）に修正。
4. **テスト追加・更新**:
   - `__tests__/lib/quiz/srs/scheduler.test.ts`: `dueDate` を含めた期日到来中/前進済みの各ケースのテスト。
   - `__tests__/lib/quiz/srs/update.test.ts`: 同日回答履歴がある期日到来中アイテムが正解で前進することのテスト。
   - `__tests__/server/` 関連または actions のテストで `everWrong` の正しい早期卒業/非早期卒業を確認。
