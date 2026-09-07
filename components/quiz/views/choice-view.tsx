'use client';

import { CircleCheck, CircleX } from 'lucide-react';
import type { FeedbackState } from '../use-quiz-session';

/** HUD の中では文字を色分けしない。詳細は `hudChoiceStyle` の注記を参照。 */
export type ChoiceAppearance = 'default' | 'hud';

interface ChoiceViewProps {
  readonly choices: readonly string[];
  readonly selectedChoice: string | null;
  readonly correctChoice: string;
  readonly feedback: FeedbackState;
  readonly onSelectChoice: (choice: string) => void;
  readonly appearance?: ChoiceAppearance;
}

/** その選択肢が解答後にどう見えるべきか。 */
type ChoiceOutcome = 'pending' | 'correct' | 'wrong' | 'muted';

function outcomeOf(
  choice: string,
  selectedChoice: string | null,
  correctChoice: string,
  feedback: FeedbackState,
): ChoiceOutcome {
  if (feedback === 'idle') return 'pending';
  if (choice === correctChoice) return 'correct';
  if (choice === selectedChoice) return 'wrong';
  return 'muted';
}

function defaultChoiceStyle(outcome: ChoiceOutcome): string {
  switch (outcome) {
    case 'correct':
      return 'border-green-500 bg-green-500/10 text-green-500';
    case 'wrong':
      return 'border-red-500 bg-red-500/10 text-red-500';
    default:
      return 'border-border hover:border-primary/50';
  }
}

/**
 * HUD の中では文字を白のままにし、正否は枠と色付きアイコンで示す（FR-037）。
 *
 * 文字を色分けすると不正解の赤 (#ef4444) が帯の地色 #111111 上で 5.02:1 にしかならず、
 * 弱視向けに必要な 7:1 に届かない。枠とアイコンは非テキストなので基準が 3:1 で足りる。
 */
function hudChoiceStyle(outcome: ChoiceOutcome): string {
  switch (outcome) {
    case 'correct':
      return 'border-[#22c55e] bg-[#22c55e]/10 text-[#fafafa]';
    case 'wrong':
      return 'border-[#ef4444] bg-[#ef4444]/10 text-[#fafafa]';
    case 'muted':
      return 'border-white/20 text-[#fafafa]/70';
    default:
      return 'border-white/20 text-[#fafafa]';
  }
}

function OutcomeIcon({ outcome }: Readonly<{ outcome: ChoiceOutcome }>) {
  if (outcome !== 'correct' && outcome !== 'wrong') return null;
  const Icon = outcome === 'correct' ? CircleCheck : CircleX;
  const color = outcome === 'correct' ? '#22c55e' : '#ef4444';

  return (
    <>
      <Icon
        size={16}
        // 塗りをアイコン色、線を帯の地色にして、丸の中に記号を抜く。
        fill={color}
        stroke="#111111"
        className="shrink-0"
        aria-hidden
      />
      <span className="sr-only">{outcome === 'correct' ? '正解' : '不正解'}。</span>
    </>
  );
}

export function ChoiceView({
  choices,
  selectedChoice,
  correctChoice,
  feedback,
  onSelectChoice,
  appearance = 'default',
}: Readonly<ChoiceViewProps>) {
  const isHud = appearance === 'hud';

  return (
    <div className="flex flex-col gap-2">
      {choices.map((choice) => {
        const outcome = outcomeOf(choice, selectedChoice, correctChoice, feedback);
        const btnStyle = isHud ? hudChoiceStyle(outcome) : defaultChoiceStyle(outcome);

        return (
          <button
            key={choice}
            disabled={feedback !== 'idle'}
            onClick={() => onSelectChoice(choice)}
            className={`flex w-full items-center gap-2 rounded-xl border p-3 text-left text-sm transition-colors ${btnStyle}`}
          >
            {isHud && <OutcomeIcon outcome={outcome} />}
            <span className="min-w-0 flex-1">{choice}</span>
          </button>
        );
      })}
    </div>
  );
}
