'use client';

import React from 'react';
import { formatDifficulty, type Difficulty } from '@/lib/quiz/municipality-data';
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

function SingleItemBody({
  item,
  difficultyLabel,
}: Readonly<{ item: FeedbackItem; difficultyLabel: string }>) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-xs pt-0.5">
      <div className="flex items-baseline gap-1.5 min-w-0 truncate">
        <span className="font-bold text-sm text-white truncate">{item.name}</span>
        {item.kana && (
          <span className="text-[11px] text-white/70 shrink-0">{item.kana}</span>
        )}
        <span className="text-[10px] text-white/50 shrink-0">（{item.prefecture}）</span>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 text-[11px] text-white/80">
        {difficultyLabel && (
          <span className="text-amber-400/90 font-medium">
            {difficultyLabel}
          </span>
        )}
        {difficultyLabel && item.formattedPopulation && (
          <span className="text-white/30">|</span>
        )}
        {item.formattedPopulation && (
          <span>{item.formattedPopulation}</span>
        )}
      </div>
    </div>
  );
}

function MultiItemsBody({ items }: Readonly<{ items: readonly FeedbackItem[] }>) {
  return (
    <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px] border-t border-white/10 pt-1">
      {items.slice(0, 4).map((item) => (
        <div key={item.prefecture} className="flex justify-between items-baseline gap-1 truncate">
          <span className="text-white/90 truncate">
            {item.prefecture}
            {item.kana && (
              <span className="text-[10px] text-white/60 ml-0.5">
                ({item.kana.replace(/(ちょう|まち|し|く|そん|むら)$/, '')})
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
  );
}

function buildSrText(
  firstItem: FeedbackItem | undefined,
  isCorrect: boolean,
  isMulti: boolean,
  difficultyLabel: string,
  items: readonly FeedbackItem[],
): string {
  if (!firstItem) return '';
  const diffText = difficultyLabel ? `難易度: ${difficultyLabel}、` : '';
  const popText = firstItem.formattedPopulation ? `人口: ${firstItem.formattedPopulation}` : '';
  const kanaText = firstItem.kana ? `${firstItem.kana}、` : '';
  const prefText = isMulti && items.length > 1
    ? `（${items.map((i) => i.prefecture).join('、')}）`
    : `（${firstItem.prefecture}）`;

  if (isCorrect) {
    return `正解！ ${firstItem.name}${prefText}、${kanaText}${diffText}${popText}`;
  }
  return `不正解。正解は${firstItem.name}${prefText}、${kanaText}${diffText}${popText}`;
}

function FeedbackHeader({
  isCorrect,
  streak,
  isMulti,
  difficultyLabel,
}: Readonly<{
  isCorrect: boolean;
  streak: number;
  isMulti: boolean;
  difficultyLabel: string;
}>) {
  const stage = resolvePraiseStage(isCorrect ? streak : 0);
  return (
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

      {isMulti && difficultyLabel && (
        <span className="text-[10px] text-amber-400/90 font-medium shrink-0">
          {difficultyLabel}
        </span>
      )}
    </div>
  );
}

export function FloatingFeedbackCard({
  isCorrect,
  streak,
  difficulty,
  items,
  onSkip,
}: Readonly<FloatingFeedbackCardProps>) {
  const isMulti = items.length > 1;
  const firstItem = items[0];
  const difficultyLabel = formatDifficulty(difficulty);
  const srText = React.useMemo(
    () => buildSrText(firstItem, isCorrect, isMulti, difficultyLabel, items),
    [firstItem, isCorrect, difficultyLabel, isMulti, items],
  );

  return (
    <div
      onClick={onSkip}
      className="pointer-events-auto absolute top-2 left-1/2 -translate-x-1/2 z-20 flex w-[calc(100%-32px)] max-w-[340px] flex-col gap-1 rounded-xl border border-white/10 bg-[#111111] p-2.5 text-[#fafafa] shadow-lg cursor-pointer max-h-[112px] select-none"
    >
      <span role="status" aria-live="polite" className="sr-only">
        {srText}
      </span>
      <div aria-hidden="true" className="flex flex-col gap-1">
        <FeedbackHeader
          isCorrect={isCorrect}
          streak={streak}
          isMulti={isMulti}
          difficultyLabel={difficultyLabel}
        />
        {!isMulti && firstItem && (
          <SingleItemBody item={firstItem} difficultyLabel={difficultyLabel} />
        )}
        {isMulti && <MultiItemsBody items={items} />}
      </div>
    </div>
  );
}

