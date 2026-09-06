'use client';

import dynamic from 'next/dynamic';
import type { FeedbackState } from '../use-quiz-session';

const MunicipalityMap = dynamic(
  () => import('@/components/map/MunicipalityMap').then((m) => m.MunicipalityMap),
  {
    ssr: false,
    loading: () => <div className="h-full w-full animate-pulse bg-muted" />,
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
    <div className="h-full w-full">
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
