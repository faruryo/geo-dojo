'use client';

import dynamic from 'next/dynamic';
import type { FeedbackState } from '../use-quiz-session';

const JapanMap = dynamic(
  () => import('@/components/map/JapanMap').then((m) => m.JapanMap),
  {
    ssr: false,
    loading: () => <div className="h-full w-full animate-pulse bg-muted" />,
  },
);

interface ModeAViewProps {
  readonly qIdx: number;
  readonly correctPrefectures: ReadonlySet<string>;
  readonly selectedPrefectures: ReadonlySet<string>;
  readonly feedback: FeedbackState;
  readonly onPrefectureTap: (name: string) => void;
}

/**
 * 県当ての地図面。確定ボタンと選択中の一覧は下端 HUD が持つので、ここは地図だけを
 * 帯のあいだいっぱいに広げる。高さは親（flex-1）が決めるため h-full で受ける。
 */
export function ModeAView({
  qIdx,
  correctPrefectures,
  selectedPrefectures,
  feedback,
  onPrefectureTap,
}: Readonly<ModeAViewProps>) {
  return (
    <div className="h-full w-full">
      <JapanMap
        onPrefectureClick={onPrefectureTap}
        selectedNames={[...selectedPrefectures]}
        highlightCorrect={feedback !== 'idle' ? [...correctPrefectures] : undefined}
        highlightWrong={undefined}
        isIncorrect={feedback === 'incorrect'}
        qIdx={qIdx}
      />
    </div>
  );
}
