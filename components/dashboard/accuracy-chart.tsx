'use client';

import { useState } from 'react';
import { useAccuracyTrend } from '@/lib/hooks/useAccuracyTrend';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { BarChart3 } from 'lucide-react';

type Period = '7d' | '30d' | 'all';

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: '7d', label: '7日' },
  { value: '30d', label: '30日' },
  { value: 'all', label: '全期間' },
];

const DIFFICULTY_LINES = [
  { key: 'easy', label: '入門', color: '#22c55e' },
  { key: 'medium', label: '中級', color: '#3b82f6' },
  { key: 'hard', label: '上級', color: '#f97316' },
  { key: 'expert', label: '達人', color: '#ef4444' },
] as const;

export function AccuracyChart({
  mode,
  region,
}: {
  mode: 'all' | 'A' | 'B' | 'C' | 'D';
  region: string;
}) {
  const [period, setPeriod] = useState<Period>('7d');
  const { data, isLoading } = useAccuracyTrend(period, mode, region);

  if (isLoading) {
    return (
      <section className="flex flex-col gap-3">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-[200px] w-full rounded-lg" />
      </section>
    );
  }

  const chartData = data ?? [];

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">正答率推移</h2>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <TabsList>
            {PERIOD_OPTIONS.map((opt) => (
              <TabsTrigger key={opt.value} value={opt.value}>
                {opt.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {chartData.length === 0 ? (
        <Card size="sm">
          <CardContent className="flex items-center justify-center gap-2 py-6">
            <BarChart3 className="size-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              データが少ないため推移は2日目以降に表示されます
            </p>
          </CardContent>
        </Card>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#888' }} axisLine={{ stroke: '#333' }} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#888' }} axisLine={{ stroke: '#333' }} tickLine={false} tickFormatter={(v: number) => `${v}%`} width={40} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#ccc' }}
              formatter={(value, name) => {
                const label = DIFFICULTY_LINES.find((d) => d.key === name)?.label ?? String(name);
                return [`${value}%`, label];
              }}
            />
            <Legend
              formatter={(value: string) => DIFFICULTY_LINES.find((d) => d.key === value)?.label ?? value}
              wrapperStyle={{ fontSize: 11 }}
            />
            {DIFFICULTY_LINES.map((d) => (
              <Line
                key={d.key}
                type="monotone"
                dataKey={d.key}
                stroke={d.color}
                strokeWidth={2}
                dot={chartData.length === 1}
                activeDot={{ r: 4 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}
