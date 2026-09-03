'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const PERIOD_OPTIONS = [
  { value: '7d', label: '7日' },
  { value: '30d', label: '30日' },
  { value: 'all', label: '全期間' },
] as const;

export const MODE_OPTIONS = [
  { value: 'all', label: '全て' },
  { value: 'A', label: '県当て(A)' },
  { value: 'B', label: '県当て練習(B)' },
  { value: 'C', label: '市当て練習(C)' },
  { value: 'D', label: '場所当て(D)' },
] as const;

export const REGIONS = [
  '全国', '北海道', '東北', '関東', '中部', '近畿', '中国', '四国', '九州',
] as const;

export type FilterPeriod = (typeof PERIOD_OPTIONS)[number]['value'];
export type FilterMode = (typeof MODE_OPTIONS)[number]['value'];
export type FilterRegion = string;

export function FilterBar({
  period,
  onPeriodChange,
  mode,
  onModeChange,
  region,
  onRegionChange,
}: {
  period?: FilterPeriod;
  onPeriodChange?: (v: FilterPeriod) => void;
  mode: FilterMode;
  onModeChange: (v: FilterMode) => void;
  region: FilterRegion;
  onRegionChange: (v: FilterRegion) => void;
}) {
  return (
    <section className="flex flex-col gap-2">
      {period !== undefined && onPeriodChange && (
        <Tabs value={period} onValueChange={(v) => onPeriodChange(v as FilterPeriod)}>
          <TabsList className="w-full">
            {PERIOD_OPTIONS.map((p) => (
              <TabsTrigger key={p.value} value={p.value} className="flex-1">
                {p.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}
      <div className="-mx-1">
        <Tabs value={mode} onValueChange={(v) => onModeChange(v as FilterMode)}>
          <TabsList className="!w-full overflow-x-auto flex-nowrap justify-start">
            {MODE_OPTIONS.map((m) => (
              <TabsTrigger key={m.value} value={m.value} className="whitespace-nowrap shrink-0">
                {m.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      <div className="-mx-1">
        <Tabs value={region} onValueChange={onRegionChange}>
          <TabsList className="!w-full overflow-x-auto flex-nowrap justify-start">
            {REGIONS.map((r) => (
              <TabsTrigger key={r} value={r} className="whitespace-nowrap shrink-0">
                {r}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
    </section>
  );
}
