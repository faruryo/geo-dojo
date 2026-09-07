'use client';

import { Timer } from 'lucide-react';
import { AbortConfirm } from '@/components/quiz/hud/abort-confirm';
import { MuteToggle } from '@/components/quiz/mute-toggle';
import { formatClearTime } from '@/lib/quiz/prefecture-quiz';
import { TOP_BAND_PX } from '@/lib/quiz/hud-metrics';

/**
 * 残り時間があるモードと経過時間を計るモードは別物として扱う。どちらも持たない
 * モードでは領域そのものを確保しない（帯の中身を詰めるため）。
 */
export type HudTimer =
  | { readonly kind: 'countdown'; readonly secondsLeft: number; readonly totalSeconds: number }
  | { readonly kind: 'elapsed'; readonly elapsedMs: number };

interface TopHudProps {
  /** 0 始まり。表示時に +1 する。 */
  readonly currentIndex: number;
  readonly totalQuestions: number;
  readonly onAbort: () => void;
  readonly timer?: HudTimer;
}

function countdownColor(secondsLeft: number, totalSeconds: number): string {
  const ratio = totalSeconds > 0 ? secondsLeft / totalSeconds : 0;
  if (ratio > 0.5) return '#22c55e';
  if (ratio > 0.2) return '#eab308';
  return '#ef4444';
}

function TimerDisplay({ timer }: Readonly<{ timer: HudTimer }>) {
  if (timer.kind === 'elapsed') {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-xs tabular-nums text-[#fafafa]">
        <Timer size={13} aria-hidden />
        {formatClearTime(timer.elapsedMs)}
      </span>
    );
  }

  const { secondsLeft, totalSeconds } = timer;
  const pct = totalSeconds > 0 ? Math.max(0, Math.min(1, secondsLeft / totalSeconds)) * 100 : 0;

  return (
    <span
      className="inline-flex items-center gap-1.5"
      role="timer"
      aria-label={`残り ${secondsLeft} 秒`}
    >
      <span className="block h-1 w-14 overflow-hidden rounded-full bg-white/20">
        <span
          className="block h-full transition-[width] duration-1000 ease-linear"
          style={{ width: `${pct}%`, backgroundColor: countdownColor(secondsLeft, totalSeconds) }}
        />
      </span>
      <span className="font-mono text-xs tabular-nums text-[#fafafa]">{secondsLeft}</span>
    </span>
  );
}

export function TopHud({
  currentIndex,
  totalQuestions,
  onAbort,
  timer,
}: Readonly<TopHudProps>) {
  return (
    <header className="shrink-0 bg-[#111111] pt-[env(safe-area-inset-top)]">
      <div
        className="flex items-center justify-between gap-2 px-1"
        style={{ height: TOP_BAND_PX }}
      >
        <AbortConfirm onAbort={onAbort} />

        <span className="font-mono text-xs tabular-nums text-[#fafafa]">
          {currentIndex + 1} / {totalQuestions}
        </span>

        <span className="inline-flex h-11 items-center gap-2 px-2">
          {timer && <TimerDisplay timer={timer} />}
          <span className="inline-flex h-11 w-11 items-center justify-center text-[#fafafa]">
            <MuteToggle />
          </span>
        </span>
      </div>
    </header>
  );
}
