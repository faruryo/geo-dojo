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
