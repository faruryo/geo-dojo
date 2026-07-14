import { and, eq, lt, type SQL } from 'drizzle-orm';
import { srsRecords } from '@/lib/db/schema';
import { getJSTStartOfTomorrow } from '@/lib/utils/date-jst';

export function dueReviewCondition(userId: string): SQL {
  return and(
    eq(srsRecords.userId, userId),
    eq(srsRecords.status, 'reviewing'),
    lt(srsRecords.dueDate, getJSTStartOfTomorrow()),
  ) as SQL;
}
