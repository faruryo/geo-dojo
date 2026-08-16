'use client';

import { Badge } from '@/components/ui/badge';
import type { Difficulty } from '@/lib/quiz/municipality-data';
import type { FeedbackState } from './use-quiz-session';

interface QuizQuestionCardProps {
  readonly promptText: string;
  readonly title: string;
  readonly subTitle?: string;
  readonly difficulty?: Difficulty;
  readonly feedback: FeedbackState;
  readonly feedbackDetail?: string;
  readonly extraPrompt?: React.ReactNode;
}

function getDifficultyBadge(difficulty?: Difficulty) {
  if (!difficulty) return null;
  let label = '';
  switch (difficulty) {
    case 'easy':
      label = '初級';
      break;
    case 'medium':
      label = '中級';
      break;
    case 'hard':
      label = '上級';
      break;
    case 'expert':
      label = '超級';
      break;
  }
  return (
    <Badge variant="secondary" className="mb-1">
      {label}
    </Badge>
  );
}

export function QuizQuestionCard({
  promptText,
  title,
  subTitle,
  difficulty,
  feedback,
  feedbackDetail,
  extraPrompt,
}: Readonly<QuizQuestionCardProps>) {
  return (
    <>
      <div className="rounded-xl bg-card p-3 text-center shrink-0">
        <p className="text-xs text-muted-foreground mb-1">{promptText}</p>
        {getDifficultyBadge(difficulty)}
        <p className="2xl:text-3xl text-2xl font-bold">{title}</p>
        {subTitle && (
          <p className="text-xs text-muted-foreground mt-1">{subTitle}</p>
        )}
        {extraPrompt}
      </div>

      {feedback !== 'idle' && (
        <div className="text-center shrink-0">
          <div
            className={`text-base font-semibold ${
              feedback === 'correct' ? 'text-green-500' : 'text-red-500'
            }`}
          >
            {feedback === 'correct' ? '✓ 正解！' : '✗ 不正解'}
          </div>
          {feedbackDetail && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {feedbackDetail}
            </p>
          )}
        </div>
      )}
    </>
  );
}
