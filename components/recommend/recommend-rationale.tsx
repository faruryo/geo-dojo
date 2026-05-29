'use client';

import { Sparkles, ShieldAlert, TrendingUp, RefreshCw, Map, BookOpen, Clock, Compass } from 'lucide-react';
import type { RationaleCategory } from '@/lib/quiz/recommendation/types';

const ICON_MAP: Record<RationaleCategory, typeof Sparkles> = {
  'cold-start': Sparkles,
  'regression': ShieldAlert,
  'difficulty-step-up': TrendingUp,
  'mode-change': RefreshCw,
  'bridging': Map,
  'weakness-focused': BookOpen,
  'review-timing': Clock,
  'new-exploration': Compass,
};

interface Props {
  category: RationaleCategory;
  text: string;
  variant: 'card' | 'sheet';
}

export function RecommendRationale({ category, text, variant }: Props) {
  const Icon = ICON_MAP[category] ?? Sparkles;

  if (variant === 'card') {
    return (
      <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
        <Icon size={12} className="shrink-0" />
        <span className="truncate">{text.slice(0, 40)}{text.length > 40 ? '…' : ''}</span>
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium text-muted-foreground">💡 なぜこの内容？</p>
      <div className="flex items-start gap-2">
        <Icon size={16} className="shrink-0 mt-0.5 text-primary" />
        <p className="text-sm leading-relaxed">{text}</p>
      </div>
    </div>
  );
}
