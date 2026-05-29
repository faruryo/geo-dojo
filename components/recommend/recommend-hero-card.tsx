'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useRecommendation } from '@/lib/hooks/useRecommendation';
import { RecommendRationale } from './recommend-rationale';
import { RecommendSheet } from './recommend-sheet';

const MODE_SHORT: Record<string, string> = {
  A: 'モードA', B: 'モードB', C: 'モードC', D: 'モードD',
};
const DIFFICULTY_SHORT: Record<string, string> = {
  easy: '☆', medium: '☆☆', hard: '☆☆☆', expert: '☆☆☆☆',
};

export function RecommendHeroCard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { data, isLoading, isError } = useRecommendation();

  function openSheet() {
    const params = new URLSearchParams(searchParams.toString());
    params.set('recommend', 'open');
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <>
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">✨ 今日のおすすめクイズ</p>
            {isLoading && (
              <div className="h-3 bg-muted rounded animate-pulse w-40 mt-1.5" />
            )}
            {isError && (
              <p className="text-xs text-muted-foreground mt-1">推薦の取得に失敗しました</p>
            )}
            {data && (
              <RecommendRationale
                category={data.rationaleCategory}
                text={data.rationaleText}
                variant="card"
              />
            )}
          </div>
          {data && (
            <div className="flex flex-col items-end gap-1 shrink-0 text-xs text-muted-foreground">
              <span>{MODE_SHORT[data.mode] ?? data.mode}</span>
              <span>{data.difficulties.map((d) => DIFFICULTY_SHORT[d] ?? d).join('/')}</span>
              <span>{data.count}問</span>
            </div>
          )}
        </div>

        <Button
          onClick={openSheet}
          disabled={isLoading || isError}
          size="sm"
          className="w-full"
        >
          {isLoading ? '準備中...' : 'おすすめを確認する'}
        </Button>
      </div>

      <RecommendSheet />
    </>
  );
}
