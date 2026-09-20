export interface PraiseStage {
  readonly streak: number;
  readonly label: string;
  readonly showStreakBadge: boolean;
  readonly pitchShiftSemitones: number;
  readonly isFanfare: boolean;
  readonly showConfetti: boolean;
}

/**
 * FR-005d: クイズ結果配列の末尾から連続正解数を算出する。
 * 不正解、タイムアウト、セッション開始時は 0 にリセットされる。
 */
export function calculateStreak(results: readonly { correct: boolean }[]): number {
  let count = 0;
  for (let i = results.length - 1; i >= 0; i--) {
    if (results[i].correct) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

/**
 * FR-005a/b/c, FR-006a/b: 連続正解数に応じた称賛段階を解決する。
 * - 1問: 「正解！」(基準音)
 * - 2連続: 「いいね！」(+2半音)
 * - 3連続: 「お見事！」(+4半音)
 * - 4連続: 「すごい！」(+6半音)
 * - 5連続: 「完璧！」(+6半音、ファンファーレ、紙吹雪) - 5連続達成時のみ！
 * - 6連続以降: 「完璧！」(+6半音、通常和音維持、紙吹雪は非表示)
 */
export function resolvePraiseStage(streak: number): PraiseStage {
  if (streak <= 0) {
    return {
      streak: 0,
      label: '不正解',
      showStreakBadge: false,
      pitchShiftSemitones: 0,
      isFanfare: false,
      showConfetti: false,
    };
  }

  if (streak === 1) {
    return {
      streak: 1,
      label: '正解！',
      showStreakBadge: false,
      pitchShiftSemitones: 0,
      isFanfare: false,
      showConfetti: false,
    };
  }

  if (streak === 2) {
    return {
      streak: 2,
      label: 'いいね！',
      showStreakBadge: true,
      pitchShiftSemitones: 2,
      isFanfare: false,
      showConfetti: false,
    };
  }

  if (streak === 3) {
    return {
      streak: 3,
      label: 'お見事！',
      showStreakBadge: true,
      pitchShiftSemitones: 4,
      isFanfare: false,
      showConfetti: false,
    };
  }

  if (streak === 4) {
    return {
      streak: 4,
      label: 'すごい！',
      showStreakBadge: true,
      pitchShiftSemitones: 6,
      isFanfare: false,
      showConfetti: false,
    };
  }

  if (streak === 5) {
    return {
      streak: 5,
      label: '完璧！',
      showStreakBadge: true,
      pitchShiftSemitones: 6,
      isFanfare: true,
      showConfetti: true, // FR-006b: 5連続達成時のみ
    };
  }

  // 6連続以降
  return {
    streak,
    label: '完璧！',
    showStreakBadge: true,
    pitchShiftSemitones: 6,
    isFanfare: false,
    showConfetti: false, // 6連続以降は非表示
  };
}
