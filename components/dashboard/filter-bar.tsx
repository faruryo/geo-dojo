'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const MODES = ['all', 'A', 'B', 'C', 'D'] as const;
const MODE_LABELS: Record<string, string> = {
  all: '全て',
  A: 'A',
  B: 'B',
  C: 'C',
  D: 'D',
};

const REGIONS = [
  '全国', '北海道', '東北', '関東', '中部', '近畿', '中国', '四国', '九州',
] as const;

export type FilterMode = (typeof MODES)[number];
export type FilterRegion = string;

export function FilterBar({
  mode,
  onModeChange,
  region,
  onRegionChange,
}: {
  mode: FilterMode;
  onModeChange: (v: FilterMode) => void;
  region: FilterRegion;
  onRegionChange: (v: FilterRegion) => void;
}) {
  return (
    <section className="flex flex-col gap-2">
      <Tabs value={mode} onValueChange={(v) => onModeChange(v as FilterMode)}>
        <TabsList>
          {MODES.map((m) => (
            <TabsTrigger key={m} value={m}>
              {MODE_LABELS[m]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="-mx-1">
        <Tabs value={region} onValueChange={onRegionChange}>
          <TabsList className="!w-full overflow-x-auto flex-nowrap justify-start">
            {REGIONS.map((r) => (
              <TabsTrigger key={r} value={r}>
                {r}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
    </section>
  );
}
