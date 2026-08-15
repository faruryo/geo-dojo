# Data Model & Contracts: 019-recommend-complete-loop

## 1. 型定義 (Types)

### `ScheduleItem` (`lib/quiz/srs/schedule-helper.ts`)
```ts
export interface ScheduleItem {
  date: string; // 'YYYY-MM-DD'
  count: number;
}
```

---

## 2. 純粋関数インターフェース

### `getTomorrowReviewCount` (`lib/quiz/srs/schedule-helper.ts`)
```ts
/**
 * 復習スケジュール一覧から、JST における「明日」の復習予定件数を抽出する純粋関数。
 *
 * @param schedule 今後N日間の復習スケジュール一覧
 * @param now 基準日時（省略時は現在日時）
 * @returns 明日の復習予定件数（見つからない場合は 0）
 */
export function getTomorrowReviewCount(
  schedule: ScheduleItem[] | undefined | null,
  now?: Date,
): number;
```

---

## 3. UI コンポーネント

### `UpcomingReviewMini` (`components/quiz/upcoming-review-mini.tsx`)
- Props: `days?: number` (既定: 7)
- 内部で `useUpcomingReviewSchedule(days)` を呼び出し、最新のスケジュール・明日の件数を表示。
- スケルトンローディング対応。
