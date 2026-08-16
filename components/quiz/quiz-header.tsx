'use client';

import { ChevronLeft } from 'lucide-react';
import { MuteToggle } from '@/components/quiz/mute-toggle';

interface QuizHeaderProps {
  readonly currentIndex: number;
  readonly totalQuestions: number;
  readonly correctCount: number;
  readonly onAbort: () => void;
}

export function QuizHeader({
  currentIndex,
  totalQuestions,
  correctCount,
  onAbort,
}: Readonly<QuizHeaderProps>) {
  return (
    <div className="flex items-center justify-between text-xs text-muted-foreground shrink-0">
      <button
        onClick={onAbort}
        className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
      >
        <ChevronLeft size={14} />
        中断
      </button>
      <span>
        {currentIndex + 1} / {totalQuestions}
      </span>
      <span className="inline-flex items-center gap-2">
        <span>{correctCount} 正解</span>
        <MuteToggle />
      </span>
    </div>
  );
}
