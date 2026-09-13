'use client';

import { Timer } from 'lucide-react';
import { AbortConfirm } from '@/components/quiz/hud/abort-confirm';
import { MuteToggle } from '@/components/quiz/mute-toggle';
import { formatClearTime } from '@/lib/quiz/prefecture-quiz';
import { TOP_BAND_PX } from '@/lib/quiz/hud-metrics';
import { COUNTDOWN_WARNING_SEC } from '@/components/quiz/use-quiz-timer';
import { cn } from '@/lib/utils';

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
      <span className="inline-flex items-center gap-1 font-mono text-xs tabular-nums text-[#fafafa] md:text-sm">
        <Timer size={13} className="md:h-4 md:w-4" aria-hidden />
        {formatClearTime(timer.elapsedMs)}
      </span>
    );
  }

  const { secondsLeft, totalSeconds } = timer;
  const pct = totalSeconds > 0 ? Math.max(0, Math.min(1, secondsLeft / totalSeconds)) * 100 : 0;
  const isWarning = secondsLeft <= COUNTDOWN_WARNING_SEC && secondsLeft > 0;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 transition-colors md:gap-2',
        isWarning
          ? 'border border-red-500/50 bg-red-950/40 shadow-[0_0_12px_rgba(239,68,68,0.35)]'
          : 'border border-transparent bg-transparent',
      )}
      role="timer"
      aria-label={`残り ${secondsLeft} 秒`}
      aria-live={isWarning ? 'assertive' : 'off'}
      aria-atomic="true"
    >
      <span
        key={isWarning ? secondsLeft : 'steady'}
        className={cn(
          'inline-flex items-center gap-1.5 md:gap-2',
          isWarning && 'motion-safe:animate-timer-pulse',
        )}
      >
        <span className="block h-1 w-14 overflow-hidden rounded-full bg-white/20 md:h-1.5 md:w-24">
          <span
            className="block h-full transition-[width] duration-1000 ease-linear"
            style={{ width: `${pct}%`, backgroundColor: countdownColor(secondsLeft, totalSeconds) }}
          />
        </span>
        <span
          className={cn(
            'min-w-[1.25rem] text-right font-mono text-xs tabular-nums md:min-w-[1.5rem] md:text-sm',
            isWarning ? 'font-bold text-red-400' : 'text-[#fafafa]',
          )}
        >
          {secondsLeft}
        </span>
      </span>
    </span>
  );
}

export function TopHud({
  currentIndex,
  totalQuestions,
  onAbort,
  timer,
}: Readonly<TopHudProps>) {
  const isWarning =
    timer?.kind === 'countdown' &&
    timer.secondsLeft <= COUNTDOWN_WARNING_SEC &&
    timer.secondsLeft > 0;

  return (
    <header className="relative shrink-0 bg-[#111111] pt-[env(safe-area-inset-top)]">
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
      <div
        className={cn(
          'pointer-events-none absolute bottom-0 left-0 right-0 h-px transition-colors duration-300',
          isWarning ? 'bg-red-500/40' : 'bg-transparent',
        )}
        aria-hidden
      />
    </header>
  );
}
