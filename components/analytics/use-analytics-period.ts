'use client';

import { useEffect, useRef, useState } from 'react';
import { getBrowserUserId } from '@/lib/auth/browser-user';
import { readAnalyticsPeriod, writeAnalyticsPeriod } from '@/lib/analytics/period-preference';
import type { FilterPeriod } from '@/components/dashboard/filter-bar';

export function useAnalyticsPeriod(): [FilterPeriod, (next: FilterPeriod) => void] {
  const [period, setPeriod] = useState<FilterPeriod>('all');
  const periodTouched = useRef(false);
  const writeSeq = useRef(0);

  useEffect(() => {
    // SSR の prefetch は全期間。保存値はマウント後に合わせ、hydration をずらさない。
    let cancelled = false;
    getBrowserUserId()
      .then((userId) => {
        if (cancelled || !userId || periodTouched.current) return;
        const saved = readAnalyticsPeriod(localStorage, userId);
        if (saved) setPeriod(saved);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  function changePeriod(next: FilterPeriod) {
    periodTouched.current = true;
    setPeriod(next);
    const seq = ++writeSeq.current;
    getBrowserUserId()
      .then((userId) => {
        if (!userId || seq !== writeSeq.current) return;
        writeAnalyticsPeriod(localStorage, userId, next);
      })
      .catch(() => {});
  }

  return [period, changePeriod];
}
