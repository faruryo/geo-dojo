# Data Model: 021-fix-review-same-day-guard

## エンティティ変更点

テーブル定義（DDL）の変更は不要。既存の `srs_records` および `municipality_quiz_results` をそのまま使用。

## ドメイン型定義の変更

### 1. `ExistingSrs` (`lib/quiz/srs/update.ts`)

```ts
export interface ExistingSrs {
  easeFactor: number;
  repetition: number;
  interval: number;
  status: SrsStatus;
  dueDate: Date; // 追加: 期日到来判定用
  lastReviewedAt: Date | null;
}
```

### 2. `alreadyAdvancedToday` (`lib/quiz/srs/scheduler.ts`)

```ts
export function alreadyAdvancedToday(
  existing: { lastReviewedAt: Date | null; dueDate: Date },
  now: Date,
): boolean {
  if (!existing.lastReviewedAt) return false;
  const isSameDay = formatJSTDate(existing.lastReviewedAt) === formatJSTDate(now);
  if (!isSameDay) return false;
  
  // 今日すでに正解して前進済み（dueDate が明日以降）の場合のみ true（スキップ対象）
  const jstStartOfTomorrow = getJSTStartOfTomorrow(now);
  return existing.dueDate.getTime() >= jstStartOfTomorrow.getTime();
}
```
