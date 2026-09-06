'use client';

import { CircleCheck, CircleX } from 'lucide-react';

/**
 * 正否は文字色ではなく色付きアイコンで示す。
 *
 * 文字を色分けすると不正解の赤 (#ef4444) が #111111 上で 5.02:1 にしかならず、
 * 弱視向けに必要な 7:1 に届かない。アイコンは非テキストなので基準が 3:1 で足り、
 * チェックと x の形の違いで色に依存しない判別もできる。
 */
interface FeedbackLineProps {
  readonly correct: boolean;
  /** よみがな・同名県の内訳を含む正解の文言。落とさずそのまま渡す。 */
  readonly detail: string;
}

export function FeedbackLine({ correct, detail }: Readonly<FeedbackLineProps>) {
  const Icon = correct ? CircleCheck : CircleX;
  const color = correct ? '#22c55e' : '#ef4444';

  return (
    <p className="flex items-start justify-center gap-1.5 px-3 text-center text-[#fafafa]">
      <Icon
        size={16}
        // 塗りをアイコン色、線を帯の地色にして、丸の中に記号を抜く。
        fill={color}
        stroke="#111111"
        className="mt-0.5 shrink-0"
        aria-hidden
      />
      <span className="text-xs leading-tight">
        <span className="sr-only">{correct ? '正解' : '不正解'}。</span>
        {detail}
      </span>
    </p>
  );
}
