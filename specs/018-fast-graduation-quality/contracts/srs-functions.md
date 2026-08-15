# Interface Contract: SRS Pure Functions

## 1. `determineReviewQuality` (`lib/quiz/srs/quality.ts`)

```ts
import type { ReviewQuality } from './types';

export const FAST_ANSWER_THRESHOLD_MS = 10_000;

/**
 * 正誤と解答時間から SM-2 の ReviewQuality を決定する純粋関数。
 *
 * - 不正解: 2
 * - 正解かつ answerTimeMs <= 10,000ms: 5
 * - 正解かつ (answerTimeMs > 10,000ms または null/undefined/負値): 4
 */
export function determineReviewQuality(
  isCorrect: boolean,
  answerTimeMs?: number | null,
): ReviewQuality;
```

---

## 2. `applySm2` (`lib/quiz/srs/sm2.ts`)

```ts
import type { ReviewQuality, SrsState, SrsUpdateResult } from './types';

/**
 * SM-2 アルゴリズムに基づき、現在の SRS 状態と評価（quality）から次の状態を算出する純粋関数。
 *
 * - quality < 3: 不正解リセット（EF低下、rep=0, interval=1, graduated=false）
 * - quality >= 3: 正解進行（EF更新、rep+1、interval計算）
 *   - graduated 判定: (interval >= 30 && rep >= 4) || (quality === 5 && rep >= 3 && interval >= 15)
 */
export function applySm2(state: SrsState, quality: ReviewQuality): SrsUpdateResult;
```

---

## 3. `computeSrsUpdate` (`lib/quiz/srs/update.ts`)

```ts
import type { ExistingSrs, SrsUpdateAction } from './types';

/**
 * 1回の回答に対する srs_records の更新内容を決める純粋関数。
 *
 * @param existing 既存の SRS レコード状態（新規出題時は null）
 * @param isCorrect 正解したかどうか
 * @param now 回答日時（JST判定用）
 * @param everWrong 過去に誤答履歴があるかどうか
 * @param answerTimeMs 解答所要時間（ミリ秒）
 */
export function computeSrsUpdate(
  existing: ExistingSrs | null,
  isCorrect: boolean,
  now: Date,
  everWrong: boolean,
  answerTimeMs?: number | null,
): SrsUpdateAction;
```
