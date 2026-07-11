'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useRecommendation } from '@/lib/hooks/useRecommendation';
import { writeRecommendationHistory } from '@/lib/quiz/recommendation/history-cache';
import { DIFFICULTY_LABEL, isModeAvailable, type Region } from '@/lib/quiz/municipality-data';
import { RecommendRationale } from './recommend-rationale';
import { RecommendOverride, type Overrides } from './recommend-override';

const MODE_LABEL: Record<string, string> = {
  A: 'モードA・逆引き地図', B: 'モードB・逆引き4択',
  C: 'モードC・順引き4択', D: 'モードD・順引き地図',
};

interface Props {
  onClose: () => void;
}

export function RecommendContent({ onClose }: Props) {
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useRecommendation();
  const [overrides, setOverrides] = useState<Overrides | null>(null);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <div className="h-5 bg-muted rounded animate-pulse w-1/2" />
        <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
        <div className="h-20 bg-muted rounded animate-pulse" />
        <div className="h-10 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col gap-4 p-4 text-center">
        <p className="text-sm text-muted-foreground">推薦の取得に失敗しました</p>
        <Button variant="outline" onClick={() => refetch()}>もう一度試す</Button>
        <Button variant="ghost" onClick={onClose}>キャンセル</Button>
      </div>
    );
  }

  const effectiveMode = overrides?.mode ?? data.mode;
  const effectiveCount = overrides?.count ?? data.count;
  const effectiveRegions = overrides ? overrides.targetRegions : data.regions;
  const effectiveDifficulties = data.difficulties;

  const hasPoolShortage = data.notes.length > 0;
  const modeAvailable = isModeAvailable(effectiveMode, effectiveRegions as Region[]);

  function handleStart() {
    writeRecommendationHistory(data!.codes);

    const params = new URLSearchParams();
    params.set('source', 'recommend');
    if (effectiveDifficulties.length > 0) params.set('difficulties', effectiveDifficulties.join(','));
    if (effectiveRegions.length > 0) params.set('region', effectiveRegions.join(','));
    params.set('count', String(effectiveCount));

    router.push(`/quiz/municipality/${effectiveMode.toLowerCase()}?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-6">
      <div>
        <h2 className="text-lg font-semibold">✨ 今日のおすすめクイズ</h2>
        <p className="text-xs text-muted-foreground mt-0.5">学習履歴に基づいて選定しました</p>
      </div>

      {/* Recommendation summary */}
      <div className="rounded-xl bg-card p-4 flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
            {MODE_LABEL[effectiveMode] ?? effectiveMode}
          </span>
          {effectiveDifficulties.map((d) => (
            <span key={d} className="px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground text-xs">
              {DIFFICULTY_LABEL[d] ?? d}
            </span>
          ))}
          <span className="px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground text-xs">
            {effectiveCount}問
          </span>
        </div>

        {effectiveRegions.length > 0 && effectiveRegions.length < 9 && (
          <p className="text-xs text-muted-foreground">
            地方: {effectiveRegions.join(' · ')}
          </p>
        )}

        <RecommendRationale
          category={data.rationaleCategory}
          text={data.rationaleText}
          variant="sheet"
        />
      </div>

      {hasPoolShortage && (
        <p className="text-xs text-yellow-500">{data.notes[0]}</p>
      )}

      {/* Override form */}
      <RecommendOverride
        initial={{ mode: data.mode, count: data.count, regions: data.regions }}
        onChange={setOverrides}
      />

      {/* CTAs — sticky bottom */}
      <div className="flex flex-col gap-2 pt-2">
        <Button onClick={handleStart} className="w-full" disabled={!modeAvailable}>
          {modeAvailable ? 'そのまま開始' : '対象地方を2つ以上選んでください'}
        </Button>
        <Button variant="ghost" onClick={onClose} className="w-full">
          キャンセル
        </Button>
      </div>
    </div>
  );
}
