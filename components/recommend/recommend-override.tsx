'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { GameMode } from '@/lib/quiz/recommendation/types';
import { REGION_VALUES } from '@/lib/quiz/recommendation/types';
import type { Recommendation } from '@/lib/quiz/recommendation/types';

const MODES: GameMode[] = ['A', 'B', 'C', 'D'];
const MODE_LABELS: Record<GameMode, string> = {
  A: 'モードA', B: 'モードB', C: 'モードC', D: 'モードD',
};
const COUNTS = [10, 20, 30] as const;

export type Overrides = {
  mode: GameMode;
  count: 10 | 20 | 30;
  excludedRegions: string[];
};

interface Props {
  initial: Pick<Recommendation, 'mode' | 'count' | 'regions'>;
  onChange: (overrides: Overrides) => void;
}

export function RecommendOverride({ initial, onChange }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<GameMode>(initial.mode);
  const [count, setCount] = useState<10 | 20 | 30>(initial.count);
  const [excludedRegions, setExcludedRegions] = useState<string[]>([]);

  function update(next: Partial<Overrides>) {
    const newOverrides: Overrides = {
      mode: next.mode ?? mode,
      count: next.count ?? count,
      excludedRegions: next.excludedRegions ?? excludedRegions,
    };
    if (next.mode !== undefined) setMode(next.mode);
    if (next.count !== undefined) setCount(next.count);
    if (next.excludedRegions !== undefined) setExcludedRegions(next.excludedRegions);
    onChange(newOverrides);
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between p-3 text-sm font-medium hover:bg-muted/30 transition-colors"
      >
        <span>🔧 内容を変える</span>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {expanded && (
        <div className="flex flex-col gap-4 p-3 border-t border-border">
          {/* Mode */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">モード</p>
            <div className="grid grid-cols-4 gap-1">
              {MODES.map((m) => (
                <button
                  key={m}
                  onClick={() => update({ mode: m })}
                  className={`py-2 rounded-lg text-xs font-medium border transition-colors ${
                    mode === m
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  {MODE_LABELS[m]}
                </button>
              ))}
            </div>
          </div>

          {/* Count */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">問題数</p>
            <div className="grid grid-cols-3 gap-1">
              {COUNTS.map((c) => (
                <button
                  key={c}
                  onClick={() => update({ count: c })}
                  className={`py-2 rounded-lg text-sm border transition-colors ${
                    count === c
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  {c}問
                </button>
              ))}
            </div>
          </div>

          {/* Excluded Regions */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">除外する地方</p>
            <div className="flex flex-wrap gap-1.5">
              {REGION_VALUES.map((r) => {
                const excluded = excludedRegions.includes(r);
                return (
                  <button
                    key={r}
                    onClick={() =>
                      update({
                        excludedRegions: excluded
                          ? excludedRegions.filter((x) => x !== r)
                          : [...excludedRegions, r],
                      })
                    }
                    className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                      excluded
                        ? 'border-destructive bg-destructive/10 text-destructive'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    {excluded ? '✕ ' : ''}{r}
                  </button>
                );
              })}
            </div>
            {excludedRegions.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {excludedRegions.length}地方を除外中
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
