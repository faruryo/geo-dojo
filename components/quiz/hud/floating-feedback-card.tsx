'use client';

import React from 'react';
import { DIFFICULTY_LABEL, type Difficulty } from '@/lib/quiz/municipality-data';
import type { FeedbackItem } from '@/lib/quiz/municipality-population';
import { resolvePraiseStage } from '@/lib/quiz/streak';

export interface FloatingFeedbackCardProps {
  /** 正解または不正解 */
  readonly isCorrect: boolean;
  /** 連続正解数 */
  readonly streak: number;
  /** 代表難易度 */
  readonly difficulty?: Difficulty;
  /** 表示対象自治体アイテム（単一またはMode A同名多県） */
  readonly items: readonly FeedbackItem[];
  /** カード本体タップ時のスキップハンドラ (FR-004a) */
  readonly onSkip?: () => void;
}

export function FloatingFeedbackCard({
  isCorrect,
  streak,
  difficulty,
  items,
  onSkip,
}: Readonly<FloatingFeedbackCardProps>) {
  const stage = resolvePraiseStage(isCorrect ? streak : 0);
  const isMulti = items.length > 1;
  const firstItem = items[0];

  // FR-006e: スクリーンリーダー用読み上げ文言（2.0s 内に読み終えるため連続数は除外）
  const srText = React.useMemo(() => {
    if (!firstItem) return '';
    const diffText = difficulty ? `難易度: ${DIFFICULTY_LABEL[difficulty]}、` : '';
    const popText = firstItem.formattedPopulation ? `人口: ${firstItem.formattedPopulation}` : '';
    const kanaText = firstItem.kana ? `${firstItem.kana}、` : '';
    const prefText = isMulti ? '' : `（${firstItem.prefecture}）`;

    if (isCorrect) {
      return `正解！ ${firstItem.name}${prefText}、${kanaText}${diffText}${popText}`;
    }
    return `不正解。正解は${firstItem.name}${prefText}、${kanaText}${diffText}${popText}`;
  }, [firstItem, isCorrect, difficulty, isMulti]);

  return (
    <div
      role="status"
      aria-live="polite"
      onClick={onSkip}
      className="pointer-events-auto absolute top-2 left-1/2 -translate-x-1/2 z-20 flex w-[calc(100%-32px)] max-w-[340px] flex-col gap-1 rounded-xl border border-white/10 bg-[#111111] p-2.5 text-[#fafafa] shadow-lg cursor-pointer max-h-[112px] select-none"
    >
      {/* 支援技術向け非表示テキスト */}
      <span className="sr-only">{srText}</span>

      {/* 1行目: 正否バッジ + 称賛/不正解ラベル + 連続正解チップ */}
      <div className="flex items-center justify-between text-xs leading-none">
        <div className="flex items-center gap-1.5">
          {isCorrect ? (
            <>
              <span className="font-bold text-emerald-400">🎉 正解！</span>
              <span className="font-semibold text-white/90 motion-safe:animate-in motion-safe:zoom-in-95">
                {stage.label}
              </span>
              {stage.showStreakBadge && (
                <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-mono text-emerald-300 font-medium">
                  {streak}連続
                </span>
              )}
            </>
          ) : (
            <span className="font-bold text-rose-400">✗ 不正解</span>
          )}
        </div>

        {/* 多県表示の場合は1行目右端に代表難易度を表示 */}
        {isMulti && difficulty && (
          <span className="text-[10px] text-amber-400/90 font-medium shrink-0">
            {DIFFICULTY_LABEL[difficulty]}
          </span>
        )}
      </div>

      {/* 2行目以降: 単一自治体表示 */}
      {!isMulti && firstItem && (
        <div className="flex items-baseline justify-between gap-2 text-xs pt-0.5">
          <div className="flex items-baseline gap-1.5 min-w-0 truncate">
            <span className="font-bold text-sm text-white truncate">{firstItem.name}</span>
            {firstItem.kana && (
              <span className="text-[11px] text-white/70 shrink-0">{firstItem.kana}</span>
            )}
            <span className="text-[10px] text-white/50 shrink-0">（{firstItem.prefecture}）</span>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 text-[11px] text-white/80">
            {difficulty && (
              <span className="text-amber-400/90 font-medium">
                {DIFFICULTY_LABEL[difficulty]}
              </span>
            )}
            {difficulty && firstItem.formattedPopulation && (
              <span className="text-white/30">|</span>
            )}
            {firstItem.formattedPopulation && (
              <span>{firstItem.formattedPopulation}</span>
            )}
          </div>
        </div>
      )}

      {/* 2行目以降: 同名多県表示（例: 池田町 4県） */}
      {isMulti && (
        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px] border-t border-white/10 pt-1">
          {items.slice(0, 4).map((item) => (
            <div key={item.prefecture} className="flex justify-between items-baseline gap-1 truncate">
              <span className="text-white/90 truncate">
                {item.prefecture}
                {item.kana && (
                  <span className="text-[10px] text-white/60 ml-0.5">
                    ({item.kana.replace(/[市区町村]$/, '')})
                  </span>
                )}
              </span>
              {item.formattedPopulation && (
                <span className="text-white/70 text-[10px] shrink-0 font-mono">
                  {item.formattedPopulation}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
