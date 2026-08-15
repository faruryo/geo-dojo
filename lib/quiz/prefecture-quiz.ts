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
  // 小数第2位で四捨五入した総秒数から分と秒を算出（59.999s -> 60.00s -> 1分00.00秒への繰り上がりを保証）
  const totalHundredths = Math.round(Math.max(0, ms) / 10);
  const totalSeconds = totalHundredths / 100;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = (totalHundredths % 6000) / 100;

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
 * weaknessFirst が有効な場合は苦手スコアが高い都道府県を前方に優先配置し、同スコア内のみシャッフルする。
 */
export function buildPrefectureQuestions(
  settings: PrefectureQuizSettings,
  weaknessMap?: Map<string, number>,
): string[] {
  const pool = getRegionsPrefectures(settings.regions);
  if (pool.length === 0) return [];

  if (settings.weaknessFirst && weaknessMap && weaknessMap.size > 0) {
    // 苦手スコアごとにグループ化
    const scoreGroups = new Map<number, string[]>();
    for (const pref of pool) {
      const score = weaknessMap.get(pref) ?? 0;
      const group = scoreGroups.get(score) ?? [];
      group.push(pref);
      scoreGroups.set(score, group);
    }

    // スコア降順（苦手度が高い順）にソートし、同スコア内のみシャッフルして結合
    const sortedScores = Array.from(scoreGroups.keys()).sort((a, b) => b - a);
    const orderedCandidates: string[] = [];
    for (const score of sortedScores) {
      const group = scoreGroups.get(score);
      if (group) {
        orderedCandidates.push(...shuffle(group));
      }
    }

    const targetCount =
      settings.count === 'all'
        ? orderedCandidates.length
        : Math.min(settings.count, orderedCandidates.length);

    return orderedCandidates.slice(0, targetCount);
  }

  const shuffled = shuffle(pool);
  const targetCount =
    settings.count === 'all'
      ? shuffled.length
      : Math.min(settings.count, shuffled.length);

  return shuffled.slice(0, targetCount);
}
