# Data Model & Types: 018-fast-graduation-quality

## 1. 型定義 (Types)

### `ReviewQuality` (`lib/quiz/srs/types.ts`)
```ts
export type ReviewQuality = 2 | 4 | 5;
```
- `2`: 不正解 (Incorrect)
- `4`: 通常正解 (Correct - Standard / > 10s or answerTime unavailable)
- `5`: 速答正解 (Correct - Fast / <= 10s)

### `SrsStatus` (`lib/quiz/srs/types.ts`)
```ts
export type SrsStatus = 'reviewing' | 'graduated';
```

### `SrsState` (`lib/quiz/srs/types.ts`)
```ts
export interface SrsState {
  easeFactor: number;
  repetition: number;
  interval: number;
  status: SrsStatus;
}
```

### `SrsUpdateResult` (`lib/quiz/srs/types.ts`)
```ts
export interface SrsUpdateResult extends SrsState {
  dueInDays: number;
  graduated: boolean;
}
```

---

## 2. 関連データベーステーブル (Existing Tables - No Schema Changes)

### `srs_records`
- `user_id`: UUID
- `municipality_code`: varchar(10)
- `mode`: varchar(10)
- `ease_factor`: real (default 2.5)
- `repetition`: integer (default 0)
- `interval`: integer (default 0)
- `due_date`: timestamp with time zone
- `last_reviewed_at`: timestamp with time zone
- `status`: varchar(20) ('reviewing' | 'graduated')

### `municipality_quiz_results`
- `user_id`: UUID
- `municipality_code`: varchar(10)
- `mode`: varchar(10)
- `is_correct`: boolean
- `answer_time_ms`: integer (NULL許容)
- `answered_at`: timestamp with time zone
