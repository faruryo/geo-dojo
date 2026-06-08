'use client';

import { useState } from 'react';
import { useDashboardSummary } from '@/lib/hooks/useDashboardSummary';
import { SummaryCards } from '@/components/dashboard/summary-cards';
import { AccuracyChart } from '@/components/dashboard/accuracy-chart';
import { CompletionChart } from '@/components/dashboard/completion-chart';
import { WeaknessRanking } from '@/components/dashboard/weakness-ranking';
import { StreakDisplay } from '@/components/dashboard/streak-display';
import { CompletionProgress } from '@/components/dashboard/completion-progress';
import { DifficultyProgress } from '@/components/dashboard/difficulty-progress';
import { ReviewCard } from '@/components/dashboard/review-card';
import { MilestoneBanner } from '@/components/dashboard/milestone-banner';
import { FilterBar, type FilterMode } from '@/components/dashboard/filter-bar';
import { RecommendHeroCard } from '@/components/recommend/recommend-hero-card';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

/**
 * ダッシュボード表示本体（client）。各部品はサーバ側プリフェッチ
 * （lib/dashboard/prefetch.ts → HydrationBoundary）でハイドレート済みの
 * TanStack Query キャッシュを読むため、初回フェッチは発生しない。
 * フィルタ変更などオンデマンド再取得は従来どおり各フックが担う。
 */
export function DashboardClient() {
  const { data: summary } = useDashboardSummary();

  const [accMode, setAccMode] = useState<FilterMode>('all');
  const [accRegion, setAccRegion] = useState('全国');

  const [compMode, setCompMode] = useState<FilterMode>('all');
  const [compRegion, setCompRegion] = useState('全国');

  return (
    <div className="flex flex-col gap-6 p-4 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">GeoDojo</h1>
        <p className="text-xs text-muted-foreground">日本地理クイズ</p>
      </div>

      {summary && summary.totalQuestions > 0 && (
        <MilestoneBanner
          totalCorrect={summary.totalCorrect}
          coverageRate={summary.coverageRate}
        />
      )}

      {/* 新規ユーザー向け: クイズ未経験の場合はおすすめクイズを最初のアクションとして表示 */}
      {(!summary || summary.totalQuestions === 0) && <RecommendHeroCard />}

      <SummaryCards />

      {summary && summary.totalQuestions > 0 && (
        <>
          {/* 復習ハブ（行動+状態を集約）。優先度: 復習 > 今日のおすすめクイズ (FR-020) */}
          <ReviewCard />
          <RecommendHeroCard />

          <StreakDisplay />

          <Card>
            <CardContent className="flex flex-col gap-5">
              <FilterBar
                mode={accMode}
                onModeChange={setAccMode}
                region={accRegion}
                onRegionChange={setAccRegion}
              />

              <Separator />

              <AccuracyChart mode={accMode} region={accRegion} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-5">
              <FilterBar
                mode={compMode}
                onModeChange={setCompMode}
                region={compRegion}
                onRegionChange={setCompRegion}
              />

              <Separator />

              <CompletionChart mode={compMode} region={compRegion} />

              <Separator />

              <CompletionProgress mode={compMode} region={compRegion} />

              <Separator />

              <DifficultyProgress mode={compMode} region={compRegion} />
            </CardContent>
          </Card>

          <WeaknessRanking />
        </>
      )}
    </div>
  );
}
