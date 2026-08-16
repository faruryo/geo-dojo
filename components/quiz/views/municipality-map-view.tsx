'use client';

import dynamic from 'next/dynamic';
import type { FeedbackState } from '../use-quiz-session';

const MunicipalityMap = dynamic(
  () => import('@/components/map/MunicipalityMap').then((m) => m.MunicipalityMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full aspect-square bg-muted rounded-xl animate-pulse" />
    ),
  },
);

interface MunicipalityMapViewProps {
  readonly prefecture: string;
  readonly qIdx: number;
  readonly correctCodes: readonly string[];
  readonly wrongCodes: readonly string[];
  readonly feedback: FeedbackState;
  readonly onMunicipalityClick: (code: string, name: string) => void;
  readonly onLoadError: () => void;
}

export function MunicipalityMapView({
  prefecture,
  qIdx,
  correctCodes,
  wrongCodes,
  feedback,
  onMunicipalityClick,
  onLoadError,
}: Readonly<MunicipalityMapViewProps>) {
  return (
    <div className="flex-1 min-h-0 w-full">
      <MunicipalityMap
        prefecture={prefecture}
        onMunicipalityClick={onMunicipalityClick}
        highlightCodes={[...correctCodes]}
        wrongCodes={[...wrongCodes]}
        isIncorrect={feedback === 'incorrect'}
        qIdx={qIdx}
        onLoadError={onLoadError}
      />
    </div>
  );
}
