'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAiCandidates } from '@/lib/hooks/useAiCandidates';
import { AiReviewCard } from '@/components/ai/AiReviewCard';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabase/client';
import { Sparkles } from 'lucide-react';

export default function AiReviewPage() {
  const queryClient = useQueryClient();
  const { data: candidates = [], isLoading } = useAiCandidates();

  // Supabase Realtime: ai_candidates の status 変化を監視してキャッシュ更新
  useEffect(() => {
    const channel = supabase
      .channel('ai-candidates-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'ai_candidates' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['ai-candidates'] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  async function handleApprove(id: string, notes: string, tags: string[]) {
    await fetch(`/api/ai-candidates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve', notes, tags }),
    });
    await queryClient.invalidateQueries({ queryKey: ['ai-candidates'] });
    await queryClient.invalidateQueries({ queryKey: ['cards'] });
  }

  async function handleReject(id: string) {
    await fetch(`/api/ai-candidates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject' }),
    });
    await queryClient.invalidateQueries({ queryKey: ['ai-candidates'] });
  }

  const pending = candidates.filter((c) => c.status === 'pending');
  const processing = candidates.filter((c) => c.status === 'processing');

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-semibold">AI候補レビュー</h1>
        {pending.length > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
            {pending.length}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-4">
          {[0, 1].map((i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
      ) : candidates.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
          <Sparkles size={48} className="text-muted-foreground" />
          <p className="text-muted-foreground text-sm text-center">
            AI候補はありません。<br />
            カード作成時に「AIに提案させる」を使うと候補が表示されます。
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {processing.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {processing.length}件を解析中（自動更新）
            </p>
          )}
          {[...pending, ...processing].map((candidate) => (
            <AiReviewCard
              key={candidate.id}
              candidate={candidate}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          ))}
        </div>
      )}
    </div>
  );
}
