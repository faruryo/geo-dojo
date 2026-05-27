'use client';

import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

const STORAGE_KEY = 'geodojo:milestones:dismissed';

const CORRECT_THRESHOLDS = [
  { id: 'correct-5000', min: 5000, text: '正解数 5,000 達成！' },
  { id: 'correct-1000', min: 1000, text: '正解数 1,000 達成！' },
  { id: 'correct-500', min: 500, text: '正解数 500 達成！' },
  { id: 'correct-100', min: 100, text: '正解数 100 達成！' },
] as const;

const COVERAGE_THRESHOLDS = [
  { id: 'coverage-100', min: 1.0, text: '全国制覇率 100%！' },
  { id: 'coverage-75', min: 0.75, text: '全国制覇率 75% 達成！' },
  { id: 'coverage-50', min: 0.5, text: '全国制覇率 50% 達成！' },
  { id: 'coverage-25', min: 0.25, text: '全国制覇率 25% 達成！' },
] as const;

function getDismissed(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function addDismissed(id: string) {
  const current = getDismissed();
  if (!current.includes(id)) {
    current.push(id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  }
}

export function MilestoneBanner({
  totalCorrect,
  coverageRate,
}: {
  totalCorrect: number;
  coverageRate: number;
}) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setDismissed(getDismissed());
    setMounted(true);
  }, []);

  const handleDismiss = useCallback((id: string) => {
    addDismissed(id);
    setDismissed(getDismissed());
  }, []);

  if (!mounted) return null;

  // Find highest undismissed milestone
  const correctMilestone = CORRECT_THRESHOLDS.find(
    (t) => totalCorrect >= t.min && !dismissed.includes(t.id),
  );
  const coverageMilestone = COVERAGE_THRESHOLDS.find(
    (t) => coverageRate >= t.min && !dismissed.includes(t.id),
  );

  // Pick the "bigger" one: prefer coverage 100% > correct 5000 > coverage 75% ...
  // Simple heuristic: show whichever has a higher threshold rank
  const milestone = coverageMilestone ?? correctMilestone;
  if (!milestone) return null;

  return (
    <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/10 p-3">
      <span className="text-sm font-medium">{milestone.text}</span>
      <button
        onClick={() => handleDismiss(milestone.id)}
        className="ml-2 shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
        aria-label="閉じる"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
