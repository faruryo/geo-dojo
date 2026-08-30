'use client';

import { useDashboardSummary } from '@/lib/hooks/useDashboardSummary';
import { CompletionProgress } from '@/components/dashboard/completion-progress';
import { ReviewCard } from '@/components/dashboard/review-card';
import { RecommendHeroCard } from '@/components/recommend/recommend-hero-card';

export function DashboardClient() {
  const { data: summary } = useDashboardSummary();

  const summaryPending = summary === undefined;
  const hasPlayed = (summary?.totalQuestions ?? 0) > 0;

  return (
    <div className="flex flex-col gap-6 p-4 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">GeoDojo</h1>
        <p className="text-xs text-muted-foreground">日本地理クイズ</p>
      </div>

      <RecommendHeroCard />

      {(summaryPending || hasPlayed) && <ReviewCard />}

      <CompletionProgress mode="A" region="全国" title="県当て制覇" />
      <CompletionProgress mode="D" region="全国" title="場所当て制覇" />
    </div>
  );
}
