'use client';

import { useDashboardSummary } from '@/lib/hooks/useDashboardSummary';
import { EmptyState } from '@/components/dashboard/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

type DeltaDirection = 'up' | 'down' | 'same';

function getDelta(current: number, prev: number): DeltaDirection {
  if (current > prev) return 'up';
  if (current < prev) return 'down';
  return 'same';
}

function DeltaIndicator({ direction }: Readonly<{ direction: DeltaDirection }>) {
  switch (direction) {
    case 'up':
      return <span className="text-green-400">↑</span>;
    case 'down':
      return <span className="text-red-400">↓</span>;
    case 'same':
      return <span className="text-muted-foreground">→</span>;
  }
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function SummaryCard({
  label,
  value,
  delta,
}: Readonly<{
  label: string;
  value: string;
  delta: DeltaDirection;
}>) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold">{value}</span>
          <DeltaIndicator direction={delta} />
        </div>
      </CardContent>
    </Card>
  );
}

type SummaryData = NonNullable<ReturnType<typeof useDashboardSummary>['data']>;

interface CardItem {
  label: string;
  value: string;
  delta: DeltaDirection;
}

function renderSummaryCards(cards: readonly CardItem[]) {
  return (
    <section className="grid grid-cols-2 gap-3">
      {cards.map((card) => (
        <SummaryCard key={card.label} label={card.label} value={card.value} delta={card.delta} />
      ))}
    </section>
  );
}

function getBaseSummaryCards(data: SummaryData): readonly [CardItem, CardItem] {
  return [
    {
      label: '累計出題数',
      value: data.totalQuestions.toLocaleString(),
      delta: getDelta(data.totalQuestions, data.prev.totalQuestions),
    },
    {
      label: '全体正答率',
      value: formatPercent(data.overallAccuracy),
      delta: getDelta(data.overallAccuracy, data.prev.overallAccuracy),
    },
  ];
}

function AnalyticsCards({ data }: Readonly<{ data: SummaryData }>) {
  const conquestA = data.conquestRateA ?? 0;
  const prevConquestA = data.prev?.conquestRateA ?? 0;
  const conquestD = data.conquestRateD ?? 0;
  const prevConquestD = data.prev?.conquestRateD ?? 0;

  return renderSummaryCards([
    ...getBaseSummaryCards(data),
    {
      label: '県当て(A)制覇率',
      value: formatPercent(conquestA),
      delta: getDelta(conquestA, prevConquestA),
    },
    {
      label: '場所当て(D)制覇率',
      value: formatPercent(conquestD),
      delta: getDelta(conquestD, prevConquestD),
    },
  ]);
}

function DashboardCards({ data }: Readonly<{ data: SummaryData }>) {
  return renderSummaryCards([
    ...getBaseSummaryCards(data),
    {
      label: '学習済み',
      value: data.studiedCount.toLocaleString(),
      delta: getDelta(data.studiedCount, data.prev.studiedCount),
    },
    {
      label: '全国制覇',
      value: formatPercent(data.coverageRate),
      delta: getDelta(data.coverageRate, data.prev.coverageRate),
    },
  ]);
}

function SummarySkeleton() {
  return (
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
  );
}

export function SummaryCards({
  variant = 'dashboard',
}: {
  variant?: 'dashboard' | 'analytics';
} = {}) {
  const { data, isLoading } = useDashboardSummary();

  if (isLoading) return <SummarySkeleton />;
  if (!data || data.totalQuestions === 0) {
    return <EmptyState message="まだクイズを受けていません。クイズを始めましょう！" />;
  }

  return variant === 'analytics' ? <AnalyticsCards data={data} /> : <DashboardCards data={data} />;
}
