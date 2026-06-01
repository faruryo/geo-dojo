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
import { ReviewRecommendations } from '@/components/dashboard/review-recommendations';
import { ReviewProgress } from '@/components/dashboard/review-progress';
import { MilestoneBanner } from '@/components/dashboard/milestone-banner';
import { FilterBar, type FilterMode } from '@/components/dashboard/filter-bar';
import { RecommendHeroCard } from '@/components/recommend/recommend-hero-card';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export default function DashboardPage() {
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

      <RecommendHeroCard />

      <SummaryCards />

      {summary && summary.totalQuestions > 0 && (
        <>
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

          <ReviewRecommendations />

          <ReviewProgress />
        </>
      )}
    </div>
  );
}
