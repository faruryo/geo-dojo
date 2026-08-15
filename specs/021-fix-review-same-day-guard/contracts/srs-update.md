# Contract: SRS Update and Guard Conditions

## Pure Functions

### `alreadyAdvancedToday` (`lib/quiz/srs/scheduler.ts`)

```ts
export function alreadyAdvancedToday(
  existing: { lastReviewedAt: Date | null; dueDate: Date },
  now: Date,
): boolean
```

- **Invariants**:
  - `existing.lastReviewedAt` が `null` の場合は `false`。
  - `existing.lastReviewedAt` の JST 日付と `now` の JST 日付が異なる場合は `false`。
  - 同 JST 日付であっても、`existing.dueDate < getJSTStartOfTomorrow(now)`（期日到来中）の場合は `false`。
  - 同 JST 日付かつ `existing.dueDate >= getJSTStartOfTomorrow(now)`（前進済み）の場合のみ `true`。

### `computeSrsUpdate` (`lib/quiz/srs/update.ts`)

```ts
export function computeSrsUpdate(
  existing: ExistingSrs | null,
  isCorrect: boolean,
  now: Date,
  everWrong: boolean,
  answerTimeMs?: number | null,
): SrsUpdateAction
```

- **Invariants**:
  - `isCorrect = true` かつ `existing` ありのとき、`alreadyAdvancedToday(existing, now)` が `true` の場合のみ `{ kind: 'skip' }`。
  - `isCorrect = false`（不正解）時は、同日回答履歴の有無にかかわらず常にリセット（翌日 due / rep 0）を実行。
