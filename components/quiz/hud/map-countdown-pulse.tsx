'use client';

import { cn } from '@/lib/utils';
import {
  getMapPulseType,
  shouldShowMapPulse,
  type FeedbackState,
} from '@/lib/quiz/countdown-pulse';

interface MapCountdownPulseProps {
  readonly secondsLeft: number;
  readonly feedback: FeedbackState;
}

/**
 * Mode D などのマップ領域端（四辺エッジ）を、カウントダウンに合わせて赤くパルス（明滅）させるオーバーレイ。
 *
 * - pointer-events-none で地図操作（タップ・パン・ピンチ）を一切邪魔しない。
 * - 中央領域は完全透過し、市区町村名や境界線のコントラスト比を 100% 維持。
 * - 0.5秒のブレスパルス（なだらかな立ち上がりと減衰）により、不快感・グレアを排除。
 * - prefers-reduced-motion ではパルスアニメーションを抑止。
 */
export function MapCountdownPulse({
  secondsLeft,
  feedback,
}: Readonly<MapCountdownPulseProps>) {
  if (!shouldShowMapPulse(secondsLeft, feedback)) {
    return null;
  }

  const pulseType = getMapPulseType(secondsLeft);
  const isDanger = pulseType === 'danger';

  return (
    <div
      key={secondsLeft}
      data-testid="map-countdown-pulse"
      data-seconds={secondsLeft}
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-0 z-20 overflow-hidden opacity-0 motion-safe:animate-map-edge-pulse',
        isDanger
          ? 'border-2 border-red-500/40 shadow-[inset_0_0_24px_rgba(255,77,77,0.5),inset_0_0_48px_rgba(255,77,77,0.25)]'
          : 'border border-red-500/30 shadow-[inset_0_0_20px_rgba(255,77,77,0.35),inset_0_0_36px_rgba(255,77,77,0.15)]',
      )}
    />
  );
}
