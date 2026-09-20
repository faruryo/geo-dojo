'use client';

import { Badge } from '@/components/ui/badge';
import { DIFFICULTY_LABEL, type Difficulty } from '@/lib/quiz/municipality-data';
import { resolvePraiseStage } from '@/lib/quiz/streak';
import type { FeedbackState } from './use-quiz-session';

interface QuizQuestionCardProps {
  readonly promptText: string;
  readonly title: string;
  readonly subTitle?: string;
  readonly difficulty?: Difficulty;
  readonly feedback: FeedbackState;
  readonly feedbackDetail?: string;
  readonly extraPrompt?: React.ReactNode;
  readonly streak?: number;
  readonly populationText?: string | null;
}

function getDifficultyBadge(difficulty?: Difficulty) {
  if (!difficulty) return null;
  let label = '';
  switch (difficulty) {
    case 'easy':
      label = DIFFICULTY_LABEL.easy;
      break;
    case 'medium':
      label = DIFFICULTY_LABEL.medium;
      break;
    case 'hard':
      label = DIFFICULTY_LABEL.hard;
      break;
    case 'expert':
      label = DIFFICULTY_LABEL.expert;
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
  streak = 0,
  populationText,
}: Readonly<QuizQuestionCardProps>) {
  const stage = resolvePraiseStage(feedback === 'correct' ? streak : 0);

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
            className={`flex items-center justify-center gap-1.5 text-base font-semibold ${
              feedback === 'correct' ? 'text-emerald-500' : 'text-red-500'
            }`}
          >
            {feedback === 'correct' ? (
              <>
                <span>🎉 正解！</span>
                <span className="motion-safe:animate-in motion-safe:zoom-in-95">
                  {stage.label}
                </span>
                {stage.showStreakBadge && (
                  <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-xs font-mono text-emerald-400">
                    {streak}連続
                  </span>
                )}
              </>
            ) : (
              '✗ 不正解'
            )}
          </div>
          {(feedbackDetail || populationText) && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-2">
              {feedbackDetail && <span>{feedbackDetail}</span>}
              {feedbackDetail && populationText && <span className="opacity-40">|</span>}
              {populationText && <span>人口 {populationText}</span>}
            </p>
          )}
        </div>
      )}
    </>
  );
}
