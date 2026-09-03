'use client';

import { useState } from 'react';
import { useDashboardSummary } from '@/lib/hooks/useDashboardSummary';
import { SummaryCards } from '@/components/dashboard/summary-cards';
import {
  FilterBar,
  type FilterPeriod,
  type FilterMode,
  type FilterRegion,
} from '@/components/dashboard/filter-bar';
import { AccuracyChart } from '@/components/dashboard/accuracy-chart';
import { DifficultyProgress } from '@/components/dashboard/difficulty-progress';
import { WeaknessRanking } from '@/components/dashboard/weakness-ranking';
import { EmptyState } from '@/components/dashboard/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function AnalyticsClient() {
  const { data: summary, isLoading } = useDashboardSummary();

  const [period, setPeriod] = useState<FilterPeriod>('7d');
  const [mode, setMode] = useState<FilterMode>('all');
  const [region, setRegion] = useState<FilterRegion>('全国');

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-4 pb-20 max-w-[430px] mx-auto">
        <header className="flex flex-col gap-1">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-4 w-48" />
        </header>
        <section className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card size="sm" key={i}>
              <CardContent className="flex flex-col gap-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-7 w-20" />
              </CardContent>
            </Card>
          ))}
        </section>
      </div>
    );
  }

  const isEmpty = !summary || summary.totalQuestions === 0;

  return (
    <div className="flex flex-col gap-6 p-4 pb-20 max-w-[430px] mx-auto">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">詳細分析</h1>
        <p className="text-xs text-muted-foreground">学習の推移・苦手・モード別進捗</p>
      </header>

      {isEmpty ? (
        <EmptyState message="まだクイズを受けていません。クイズを始めましょう！" />
      ) : (
        <>
          <SummaryCards variant="analytics" />

          <FilterBar
            period={period}
            onPeriodChange={setPeriod}
            mode={mode}
            onModeChange={setMode}
            region={region}
            onRegionChange={setRegion}
          />

          <AccuracyChart
            mode={mode}
            region={region}
            period={period}
            onPeriodChange={setPeriod}
            showPeriodTabs={false}
          />

          <DifficultyProgress mode={mode} region={region} />

          <WeaknessRanking period={period} mode={mode} region={region} />
        </>
      )}
    </div>
  );
}
