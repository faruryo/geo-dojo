'use client';

import type { FeedbackState } from '../use-quiz-session';

interface ChoiceViewProps {
  readonly choices: readonly string[];
  readonly selectedChoice: string | null;
  readonly correctChoice: string;
  readonly feedback: FeedbackState;
  readonly onSelectChoice: (choice: string) => void;
}

function getChoiceButtonStyle(
  choice: string,
  selectedChoice: string | null,
  correctChoice: string,
  feedback: FeedbackState,
): string {
  if (feedback === 'idle') {
    return 'border-border hover:border-primary/50';
  }
  const isSelected = selectedChoice === choice;
  const isCorrect = choice === correctChoice;

  if (isSelected && isCorrect) {
    return 'border-green-500 bg-green-500/10 text-green-500';
  }
  if (isSelected && !isCorrect) {
    return 'border-red-500 bg-red-500/10 text-red-500';
  }
  if (isCorrect) {
    return 'border-green-500 bg-green-500/10 text-green-500';
  }
  return 'border-border hover:border-primary/50';
}

export function ChoiceView({
  choices,
  selectedChoice,
  correctChoice,
  feedback,
  onSelectChoice,
}: Readonly<ChoiceViewProps>) {
  return (
    <div className="flex flex-col gap-2">
      {choices.map((choice) => {
        const btnStyle = getChoiceButtonStyle(
          choice,
          selectedChoice,
          correctChoice,
          feedback,
        );

        return (
          <button
            key={choice}
            disabled={feedback !== 'idle'}
            onClick={() => onSelectChoice(choice)}
            className={`w-full rounded-xl border p-3 text-left text-sm transition-colors ${btnStyle}`}
          >
            {choice}
          </button>
        );
      })}
    </div>
  );
}
