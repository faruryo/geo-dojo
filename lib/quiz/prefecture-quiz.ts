import {
  type Region,
  getRegionsPrefectures,
  shuffle,
} from '@/lib/quiz/municipality-data';

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

/**
 * ミリ秒を "M:SS.ss" または "SS.ss" 形式にフォーマットする純粋関数。
 */
export function formatClearTime(ms: number): string {
  const totalSeconds = Math.max(0, ms) / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 0) {
    const secStr = seconds < 10 ? `0${seconds.toFixed(2)}` : seconds.toFixed(2);
    return `${minutes}:${secStr}`;
  }

  return `${seconds.toFixed(2)}s`;
}

/**
 * 自己ベストタイムの判定を行う純粋関数。
 */
export function isNewBestTime(currentMs: number, bestMs: number | null | undefined): boolean {
  if (bestMs === null || bestMs === undefined) return true;
  return currentMs < bestMs;
}

/**
 * 都道府県クイズの出題配列を生成する純粋関数。
 */
export function buildPrefectureQuestions(
  settings: PrefectureQuizSettings,
  weaknessMap?: Map<string, number>,
): string[] {
  const pool = getRegionsPrefectures(settings.regions);
  if (pool.length === 0) return [];

  let candidates: string[] = [...pool];

  if (settings.weaknessFirst && weaknessMap && weaknessMap.size > 0) {
    candidates.sort((a, b) => {
      const scoreA = weaknessMap.get(a) ?? 0;
      const scoreB = weaknessMap.get(b) ?? 0;
      return scoreB - scoreA;
    });
  } else {
    candidates = shuffle(candidates);
  }

  const targetCount =
    settings.count === 'all'
      ? candidates.length
      : Math.min(settings.count, candidates.length);

  const selected = candidates.slice(0, targetCount);
  return shuffle(selected);
}
