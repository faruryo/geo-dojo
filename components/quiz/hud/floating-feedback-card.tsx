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
  /** 追加クラス名（位置指定のオーバーライド用） */
  readonly className?: string;
}

function SingleItemBody({
  item,
  difficultyLabel,
}: Readonly<{ item: FeedbackItem; difficultyLabel: string }>) {
  return (
    <div className="flex items-baseline justify-between gap-2 md:gap-4 text-xs md:text-sm pt-0.5 md:pt-1">
      <div className="flex items-baseline gap-1.5 md:gap-2.5 min-w-0 truncate">
        <span className="font-bold text-sm md:text-xl text-white truncate">{item.name}</span>
        {item.kana && (
          <span className="text-[11px] md:text-sm text-white/70 shrink-0">{item.kana}</span>
        )}
        {item.prefecture && item.prefecture !== item.name && (
          <span className="text-[10px] md:text-xs text-white/50 shrink-0">（{item.prefecture}）</span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5 md:gap-2 text-[11px] md:text-sm text-white/80">
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
    <div className="grid grid-cols-2 gap-x-2 md:gap-x-4 gap-y-0.5 md:gap-y-1.5 text-[11px] md:text-xs border-t border-white/10 pt-1 md:pt-2">
      {items.slice(0, 4).map((item) => (
        <div key={item.prefecture} className="flex justify-between items-baseline gap-1 truncate">
          <span className="text-white/90 truncate">
            {item.prefecture}
            {item.kana && (
              <span className="text-[10px] md:text-xs text-white/60 ml-0.5">
                ({item.kana})
              </span>
            )}
          </span>
          {item.formattedPopulation && (
            <span className="text-white/70 text-[10px] md:text-xs shrink-0 font-mono">
              {item.formattedPopulation}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function formatPrefectureText(
  firstItem: FeedbackItem,
  isMulti: boolean,
  items: readonly FeedbackItem[],
): string {
  if (isMulti && items.length > 1) {
    return `（${items.map((i) => i.prefecture).join('、')}）`;
  }
  if (firstItem.prefecture && firstItem.prefecture !== firstItem.name) {
    return `（${firstItem.prefecture}）`;
  }
  return '';
}

function buildSrText(
  firstItem: FeedbackItem | undefined,
  isCorrect: boolean,
  isMulti: boolean,
  difficultyLabel: string,
  items: readonly FeedbackItem[],
): string {
  if (!firstItem) return '';
  const prefix = isCorrect ? '正解！' : '不正解。正解は';
  const diffText = difficultyLabel ? `難易度: ${difficultyLabel}、` : '';

  if (isMulti && items.length > 1) {
    const details = items
      .map((item) => {
        const kana = item.kana ? `(${item.kana})` : '';
        const pop = item.formattedPopulation ? ` 人口: ${item.formattedPopulation}` : '';
        return `${item.prefecture}${kana}${pop}`;
      })
      .join('、');
    return `${prefix} ${firstItem.name}。${details}。${diffText}`;
  }

  const popText = firstItem.formattedPopulation ? `人口: ${firstItem.formattedPopulation}` : '';
  const kanaText = firstItem.kana ? `${firstItem.kana}、` : '';
  const prefText = formatPrefectureText(firstItem, isMulti, items);

  return `${prefix} ${firstItem.name}${prefText}、${kanaText}${diffText}${popText}`;
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
    <div className="flex items-center justify-between text-xs md:text-sm leading-none">
      <div className="flex items-center gap-1.5 md:gap-2.5">
        {isCorrect ? (
          <>
            <span className="font-bold text-emerald-400 md:text-base">🎉 正解！</span>
            <span className="font-semibold text-white/90 motion-safe:animate-in motion-safe:zoom-in-95 md:text-sm">
              {stage.label}
            </span>
            {stage.showStreakBadge && (
              <span className="rounded bg-white/10 px-1.5 py-0.5 md:px-2 md:py-0.5 text-[10px] md:text-xs font-mono text-emerald-300 font-medium">
                {streak}連続
              </span>
            )}
          </>
        ) : (
          <span className="font-bold text-rose-400 md:text-base">✗ 不正解</span>
        )}
      </div>

      {isMulti && difficultyLabel && (
        <span className="text-[10px] md:text-xs text-amber-400/90 font-medium shrink-0">
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
  className,
}: Readonly<FloatingFeedbackCardProps>) {
  const isMulti = items.length > 1;
  const firstItem = items[0];
  const difficultyLabel = formatDifficulty(difficulty);
  const srText = React.useMemo(
    () => buildSrText(firstItem, isCorrect, isMulti, difficultyLabel, items),
    [firstItem, isCorrect, difficultyLabel, isMulti, items],
  );

  const positionClasses = className ?? 'top-2 md:top-4';

  return (
    <div
      onClick={onSkip}
      className={`pointer-events-auto absolute left-1/2 -translate-x-1/2 z-20 flex w-[calc(100%-32px)] max-w-[340px] md:max-w-[480px] flex-col gap-1 md:gap-2 rounded-xl md:rounded-2xl border border-white/10 bg-[#111111] p-2.5 md:p-4 text-[#fafafa] shadow-lg md:shadow-2xl cursor-pointer max-h-[112px] md:max-h-[160px] select-none motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 duration-150 ${positionClasses}`}
    >
      <span role="status" aria-live="polite" className="sr-only">
        {srText}
      </span>
      <div aria-hidden="true" className="flex flex-col gap-1 md:gap-2">
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

