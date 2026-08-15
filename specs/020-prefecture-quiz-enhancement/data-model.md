# Data Model & Contracts: 020-prefecture-quiz-enhancement

## 1. 型定義 (Types)

```ts
import type { Region } from '@/lib/quiz/municipality-data';

export type PrefectureQuizCount = 10 | 20 | 'all';
export type PrefectureQuizType = 'normal' | 'timeAttack';

export interface PrefectureQuizSettings {
  regions: Region[];
  count: PrefectureQuizCount;
  type: PrefectureQuizType;
  weaknessFirst: boolean;
}

export interface PrefectureQuizResultEntry {
  prefecture: string;
  correct: boolean;
  timeMs?: number;
}
```

---

## 2. 純粋関数インターフェース (`lib/quiz/prefecture-quiz.ts`)

```ts
/**
 * 都道府県クイズの出題配列を生成する純粋関数。
 */
export function buildPrefectureQuestions(
  settings: PrefectureQuizSettings,
  weaknessMap?: Map<string, number>,
  randomFn?: () => number,
): string[];

/**
 * ミリ秒を "M:SS.ss" または "SS.ss" 形式にフォーマットする純粋関数。
 */
export function formatClearTime(ms: number): string;

/**
 * 自己ベストタイムの判定を行う純粋関数。
 */
export function isNewBestTime(currentMs: number, bestMs: number | null | undefined): boolean;
```
