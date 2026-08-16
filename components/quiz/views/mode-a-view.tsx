'use client';

import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { FeedbackState } from '../use-quiz-session';

const JapanMap = dynamic(
  () => import('@/components/map/JapanMap').then((m) => m.JapanMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full aspect-square bg-muted rounded-xl animate-pulse" />
    ),
  },
);

interface ModeAViewProps {
  readonly qIdx: number;
  readonly correctPrefectures: ReadonlySet<string>;
  readonly selectedPrefectures: ReadonlySet<string>;
  readonly feedback: FeedbackState;
  readonly onPrefectureTap: (name: string) => void;
  readonly onSubmit: () => void;
}

function getSubmitButtonLabel(
  feedback: FeedbackState,
  canSubmit: boolean,
  remaining: number,
): string {
  if (feedback !== 'idle') {
    return '次へ...';
  }
  if (canSubmit) {
    return '解答する';
  }
  return `あと ${remaining} か所選択`;
}

export function ModeAView({
  qIdx,
  correctPrefectures,
  selectedPrefectures,
  feedback,
  onPrefectureTap,
  onSubmit,
}: Readonly<ModeAViewProps>) {
  const remaining = correctPrefectures.size - selectedPrefectures.size;
  const canSubmit = remaining === 0 && feedback === 'idle';

  return (
    <>
      <div className="flex-1 min-h-0 w-full">
        <JapanMap
          onPrefectureClick={onPrefectureTap}
          selectedNames={[...selectedPrefectures]}
          highlightCorrect={feedback !== 'idle' ? [...correctPrefectures] : undefined}
          highlightWrong={undefined}
          isIncorrect={feedback === 'incorrect'}
          qIdx={qIdx}
        />
      </div>

      {selectedPrefectures.size > 0 && feedback === 'idle' && (
        <div className="flex flex-wrap gap-1 shrink-0 max-h-12 overflow-y-auto">
          {[...selectedPrefectures].map((p) => (
            <Badge key={p} variant="secondary" className="text-xs">
              {p}
            </Badge>
          ))}
        </div>
      )}

      <Button onClick={onSubmit} disabled={!canSubmit} className="w-full shrink-0">
        {getSubmitButtonLabel(feedback, canSubmit, remaining)}
      </Button>
    </>
  );
}
