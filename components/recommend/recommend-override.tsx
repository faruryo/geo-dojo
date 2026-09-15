'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { GameMode, Difficulty, Recommendation } from '@/lib/quiz/recommendation/types';
import { REGION_VALUES } from '@/lib/quiz/recommendation/types';
import type { RecommendOverrides } from '@/lib/quiz/recommendation/overrides';

const MODES: GameMode[] = ['A', 'B', 'C', 'D'];
const MODE_LABELS: Record<GameMode, string> = {
  A: 'モードA', B: 'モードB', C: 'モードC', D: 'モードD',
};
const COUNTS = [10, 20, 30] as const;
const DIFFICULTY_OPTIONS: readonly { readonly difficulty: Difficulty; readonly label: string }[] = [
  { difficulty: 'easy', label: '☆ 入門' },
  { difficulty: 'medium', label: '☆☆ 中級' },
  { difficulty: 'hard', label: '☆☆☆ 上級' },
  { difficulty: 'expert', label: '☆☆☆☆ 達人' },
];

export type Overrides = RecommendOverrides;

interface Props {
  readonly initial: Pick<Recommendation, 'mode' | 'count' | 'regions' | 'difficulties'>;
  readonly onChange: (overrides: Overrides) => void;
}

export function RecommendOverride({ initial, onChange }: Props) {
  // 初期値は推薦エンジンの選定のみ。localStorage の過去フィルタでは上書きしない（#107）。
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<GameMode>(initial.mode);
  const [count, setCount] = useState<10 | 20 | 30>(initial.count);
  const [targetRegions, setTargetRegions] = useState<string[]>([...initial.regions]);
  const [difficulties, setDifficulties] = useState<Difficulty[]>([...initial.difficulties]);

  function update(next: Partial<Overrides>) {
    const nextMode = next.mode ?? mode;
    const nextCount = next.count ?? count;
    const nextRegions = next.targetRegions ?? targetRegions;
    const nextDifficulties = next.difficulties ?? difficulties;

    if (next.mode !== undefined) setMode(next.mode);
    if (next.count !== undefined) setCount(next.count);
    if (next.targetRegions !== undefined) setTargetRegions(next.targetRegions);
    if (next.difficulties !== undefined) setDifficulties(next.difficulties);

    onChange({
      mode: nextMode,
      count: nextCount,
      targetRegions: nextRegions,
      difficulties: nextDifficulties,
    });
  }

  function handleDifficultyToggle(diff: Difficulty) {
    const isSelected = difficulties.includes(diff);
    const nextDifficulties = isSelected
      ? difficulties.filter((d) => d !== diff)
      : [...difficulties, diff];

    update({ difficulties: nextDifficulties });
  }

  function handleRegionToggle(region: string) {
    if (region === '全国') {
      update({ targetRegions: [] });
      return;
    }

    const isSelected = targetRegions.includes(region);
    const nextRegions = isSelected
      ? targetRegions.filter((r) => r !== region)
      : [...targetRegions, region];

    update({ targetRegions: nextRegions });
  }

  const isAllSelected = targetRegions.length === 0;

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button
        type="button"
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
                  type="button"
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
                  type="button"
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

          {/* Difficulty */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">難易度</p>
            <div className="flex flex-wrap gap-1.5">
              {DIFFICULTY_OPTIONS.map(({ difficulty: d, label }) => {
                const isSelected = difficulties.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => handleDifficultyToggle(d)}
                    className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                      isSelected
                        ? 'border-primary bg-primary/10 text-primary font-medium'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Target Regions */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">対象地域（地方）</p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handleRegionToggle('全国')}
                className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                  isAllSelected
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                全国
              </button>
              {REGION_VALUES.map((r) => {
                const isSelected = targetRegions.includes(r);
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => handleRegionToggle(r)}
                    className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                      isSelected
                        ? 'border-primary bg-primary/10 text-primary font-medium'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    {r}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
