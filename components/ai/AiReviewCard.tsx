'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import type { AiCandidate } from '@/lib/db/schema';
import { Check, X, Loader2, RefreshCw, AlertCircle } from 'lucide-react';

interface AiReviewCardProps {
  candidate: AiCandidate;
  onApprove: (id: string, notes: string, tags: string[]) => Promise<void>;
  onReject: (id: string) => Promise<void>;
  onRetry: (imageUrl?: string | null, panoId?: string | null) => Promise<void>;
}

export function AiReviewCard({ candidate, onApprove, onReject, onRetry }: AiReviewCardProps) {
  const [notes, setNotes] = useState(candidate.suggestedNotes ?? '');
  const [tags, setTags] = useState(candidate.suggestedTags.join(', '));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setNotes(candidate.suggestedNotes ?? '');
    setTags(candidate.suggestedTags.join(', '));
  }, [candidate.suggestedNotes, candidate.suggestedTags]);

  if (candidate.status === 'processing') {
    return (
      <div className="rounded-xl bg-card p-4 flex items-center gap-3 text-muted-foreground text-sm">
        <Loader2 size={16} className="animate-spin" />
        <span>AI が解析中です...</span>
      </div>
    );
  }

  if (candidate.status === 'failed') {
    return (
      <div className="rounded-xl bg-card overflow-hidden">
        {candidate.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={candidate.imageUrl}
            alt="AI候補画像"
            className="w-full max-w-2xl mx-auto self-center aspect-video object-cover opacity-50"
          />
        )}
        <div className="p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertCircle size={16} />
            <span>AI解析に失敗しました</span>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={async () => {
                setLoading(true);
                await onRetry(candidate.imageUrl, candidate.panoId);
                await onReject(candidate.id);
                setLoading(false);
              }}
              disabled={loading}
              variant="outline"
              className="flex-1 gap-1"
            >
              <RefreshCw size={16} /> 再試行
            </Button>
            <Button
              onClick={async () => {
                setLoading(true);
                await onReject(candidate.id);
                setLoading(false);
              }}
              disabled={loading}
              variant="ghost"
              className="flex-1 gap-1 text-muted-foreground"
            >
              <X size={16} /> 削除
            </Button>
          </div>
        </div>
      </div>
    );
  }

  async function handleApprove() {
    setLoading(true);
    const tagList = tags.split(/[,、\s]+/).map((t) => t.trim()).filter(Boolean);
    await onApprove(candidate.id, notes, tagList);
    setLoading(false);
  }

  async function handleReject() {
    setLoading(true);
    await onReject(candidate.id);
    setLoading(false);
  }

  return (
    <div className="rounded-xl bg-card overflow-hidden">
      {candidate.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={candidate.imageUrl}
          alt="AI候補画像"
          className="w-full max-w-2xl mx-auto self-center aspect-video object-cover"
        />
      )}
      <div className="p-4 flex flex-col gap-3">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-input bg-input px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
          placeholder="メモ（編集可能）"
        />
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          className="h-10 rounded-lg border border-input bg-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          placeholder="タグ（カンマ区切り）"
        />
        <div className="flex gap-2">
          <Button
            onClick={handleApprove}
            disabled={loading}
            className="flex-1 gap-1 bg-green-700 hover:bg-green-600"
          >
            <Check size={16} /> 承認
          </Button>
          <Button
            onClick={handleReject}
            disabled={loading}
            variant="outline"
            className="flex-1 gap-1 border-destructive text-destructive hover:bg-destructive/10"
          >
            <X size={16} /> 却下
          </Button>
        </div>
      </div>
    </div>
  );
}
