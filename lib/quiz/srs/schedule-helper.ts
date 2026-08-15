import { formatJSTDate, toJSTDate } from '@/lib/utils/date-jst';

export interface ScheduleItem {
  date: string; // 'YYYY-MM-DD'
  count: number;
}

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * JST 基準で `now` の「明日」の開始日時（UTC Date）を取得する。
 */
export function getJSTStartOfTomorrowFrom(now: Date = new Date()): Date {
  const jstNow = toJSTDate(now);
  const jstMidnight = new Date(
    Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate()),
  );
  return new Date(jstMidnight.getTime() - JST_OFFSET_MS + ONE_DAY_MS);
}

/**
 * 復習スケジュール一覧から、JST における「明日」の復習予定件数を抽出する純粋関数。
 *
 * @param schedule 今後N日間の復習スケジュール一覧
 * @param now 基準日時（省略時は現在日時）
 * @returns 明日の復習予定件数（見つからない場合は 0）
 */
export function getTomorrowReviewCount(
  schedule: ScheduleItem[] | undefined | null,
  now: Date = new Date(),
): number {
  if (!schedule || schedule.length === 0) return 0;

  const tomorrowJstDateStr = formatJSTDate(getJSTStartOfTomorrowFrom(now));
  const tomorrowItem = schedule.find((item) => item.date === tomorrowJstDateStr);

  return tomorrowItem ? tomorrowItem.count : 0;
}

/**
 * 明日から指定日数（デフォルト7日）分の日付を走査し、
 * DB から返っていない日付（0件）を埋めた連続したスケジュール配列を生成する純粋関数。
 *
 * @param schedule DBから取得した復習スケジュール一覧
 * @param days 取得・表示する日数（デフォルト: 7）
 * @param now 基準日時（省略時は現在日時）
 * @returns 欠落日を0件で埋めたスケジュール配列
 */
export function fillUpcomingDays(
  schedule: ScheduleItem[] | undefined | null,
  days = 7,
  now: Date = new Date(),
): ScheduleItem[] {
  const map = new Map<string, number>();
  if (schedule) {
    for (const item of schedule) {
      map.set(item.date, item.count);
    }
  }

  const startTomorrow = getJSTStartOfTomorrowFrom(now);
  const result: ScheduleItem[] = [];

  for (let i = 0; i < days; i++) {
    const dayDate = new Date(startTomorrow.getTime() + i * ONE_DAY_MS);
    const dateStr = formatJSTDate(dayDate);
    result.push({
      date: dateStr,
      count: map.get(dateStr) ?? 0,
    });
  }

  return result;
}
