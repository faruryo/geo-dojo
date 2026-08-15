const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export interface StreakResult {
  currentStreak: number;
  longestStreak: number;
  hasPlayedToday: boolean;
}

function calculateCurrentStreak(
  dates: string[],
  todayMs: number,
  hasPlayedToday: boolean,
  yesterdayStr: string,
): number {
  if (!hasPlayedToday && dates[0] !== yesterdayStr) {
    return 0;
  }

  let currentStreak = 0;
  let expectedMs = hasPlayedToday ? todayMs : todayMs - ONE_DAY_MS;

  for (const d of dates) {
    const expStr = new Date(expectedMs).toISOString().slice(0, 10);
    if (d === expStr) {
      currentStreak++;
      expectedMs -= ONE_DAY_MS;
    } else if (d < expStr) {
      break;
    }
  }

  return currentStreak;
}

function calculateLongestStreak(dates: string[]): number {
  let longestStreak = 0;
  let runningStreak = 0;
  let prevDateMs: number | null = null;

  for (const d of dates) {
    const currMs = new Date(`${d}T00:00:00Z`).getTime();
    if (prevDateMs === null) {
      runningStreak = 1;
    } else {
      const diffDays = Math.round((prevDateMs - currMs) / ONE_DAY_MS);
      runningStreak = diffDays === 1 ? runningStreak + 1 : 1;
    }
    if (runningStreak > longestStreak) {
      longestStreak = runningStreak;
    }
    prevDateMs = currMs;
  }

  return longestStreak;
}

/**
 * 日付リスト（YYYY-MM-DD 降順かつユニーク）と本日の日付（YYYY-MM-DD）から
 * 現在のストリークおよび全期間の最長ストリークを計算する純粋関数。
 *
 * - 日付演算は YYYY-MM-DD を UTC 0:00 としてミリ秒差を計算（タイムゾーン非依存）。
 * - 今日未プレイでも昨日プレイしていれば currentStreak は継続中（昨日までの連続数）として扱う。
 * - longestStreak は全期間の最大連続日数を走査して算出する（常に longestStreak >= currentStreak）。
 */
export function calculateStreak(dates: string[], todayStr: string): StreakResult {
  if (dates.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      hasPlayedToday: false,
    };
  }

  const hasPlayedToday = dates[0] === todayStr;
  const todayMs = new Date(`${todayStr}T00:00:00Z`).getTime();
  const yesterdayStr = new Date(todayMs - ONE_DAY_MS).toISOString().slice(0, 10);

  const currentStreak = calculateCurrentStreak(dates, todayMs, hasPlayedToday, yesterdayStr);
  const longestHistoryStreak = calculateLongestStreak(dates);

  return {
    currentStreak,
    longestStreak: Math.max(longestHistoryStreak, currentStreak),
    hasPlayedToday,
  };
}
