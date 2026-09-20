'use client';

import type React from 'react';

import { ZoomIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChoiceView } from '../views/choice-view';
import type { FeedbackState } from '../use-quiz-state';
import { FeedbackLine } from './feedback-line';
import {
  STEADY_TEXT_PX,
  bottomBandHeightPx,
  type HudFeedbackState,
  type HudQuestionMode,
} from '@/lib/quiz/hud-metrics';

export type BottomHudContent =
  | { readonly kind: 'prompt'; readonly title: string; readonly subTitle?: string }
  | { readonly kind: 'feedback'; readonly correct: boolean; readonly detail: string };

interface BottomHudProps {
  readonly content: BottomHudContent;
  readonly mode: HudQuestionMode;
  /** 県当ての確定ボタン。件数の案内はラベルへ統合する。 */
  readonly submit?: {
    readonly label: string;
    readonly disabled: boolean;
    readonly onSubmit: () => void;
    readonly shortcutHint?: string;
  };
  /** 県当てで選択中の都道府県の件数。個別の取り消しは地図の再タップで行う。 */
  readonly selectedCount?: number;
  /** 帯をタップしたときにお題を中央へ再表示する。 */
  readonly onRequestIntro?: () => void;
  /** 解答フィードバック中に帯をタップしたとき即時スキップする (FR-004a)。 */
  readonly onSkip?: () => void;
  /**
   * 移動アニメーションを行わない設定のとき、導入の代わりにお題の文字を大きく見せる。
   * 中央のオーバーレイを出さない分をここで補う。
   *
   * **帯の高さは変えない。** 地図は上下の帯に挟まれた領域いっぱいに描かれるので、
   * 帯を太らせるとその分だけ地図が縮み、戻すときに拡大率と位置がずれて見える。
   */
  readonly emphasis?: { readonly textPx: number };
  /** お題の文字を緩ませる時間（ms）。0 なら即時。 */
  readonly restoreMs?: number;
  /**
   * 復習セッション中の4択（FR-029）。
   *
   * `content` のバリアントにはしない。帯の高さは `bottomBandHeightPx` だけで決まる
   * 決まりで、選択肢4つはそこに収まらない。帯の直上に別の行として積む。
   */
  readonly choices?: {
    readonly items: readonly string[];
    readonly selected: string | null;
    readonly correct: string;
    readonly feedback: FeedbackState;
    readonly onSelect: (choice: string) => void;
  };
}

function feedbackStateOf(content: BottomHudContent): HudFeedbackState {
  if (content.kind !== 'feedback') return 'idle';
  return content.correct ? 'correct' : 'incorrect';
}

function PromptBody({
  title,
  subTitle,
  reshowable,
  textPx,
  restoreMs,
}: Readonly<{
  title: string;
  subTitle?: string;
  reshowable: boolean;
  textPx: number;
  restoreMs: number;
}>) {
  return (
    <span
      className="flex items-baseline justify-center gap-1.5 truncate px-3 text-[#fafafa]"
      style={{
        fontSize: textPx,
        transition: restoreMs > 0 ? `font-size ${restoreMs}ms ease-out` : undefined,
      }}
    >
      <span className="truncate font-semibold">{title}</span>
      {subTitle && <span className="shrink-0 text-xs text-[#fafafa]/80">{subTitle}</span>}
      {reshowable && (
        <>
          <ZoomIn size={14} className="shrink-0 self-center" aria-hidden />
          <span className="sr-only">（タップでお題を再表示）</span>
        </>
      )}
    </span>
  );
}

/** 4択はお題の行の外側に積む。行の高さは選択肢の有無で変えない。 */
function ChoiceRegion({ choices }: Readonly<Pick<BottomHudProps, 'choices'>>) {
  if (!choices) return null;
  return (
    <div className="mx-auto max-w-2xl px-3 pb-2">
      <ChoiceView
        choices={choices.items}
        selectedChoice={choices.selected}
        correctChoice={choices.correct}
        feedback={choices.feedback}
        onSelectChoice={choices.onSelect}
        appearance="hud"
      />
    </div>
  );
}

/* aria-label は付けない。付けると子要素のお題がアクセシブル名から外れ、
   中央の導入表示は aria-hidden なので読み上げでお題を取得できなくなる。
   操作の説明は sr-only のテキストで添える。 */
function BandBody({
  content,
  reshowable,
  onRequestIntro,
  onSkip,
  textPx,
  restoreMs,
}: Readonly<{
  content: BottomHudContent;
  reshowable: boolean;
  onRequestIntro?: () => void;
  onSkip?: () => void;
  textPx: number;
  restoreMs: number;
}>) {
  if (content.kind !== 'prompt') {
    // フィードバックは操作対象ではない。button に入れると無効な操作要素として
    // 読み飛ばされうるうえ、p を button の中に置けない。
    return (
      <div className="min-w-0 flex-1">
        <FeedbackLine correct={content.correct} detail={content.detail} />
      </div>
    );
  }

  const isClickable = onSkip !== undefined || reshowable;
  const handleClick = onSkip ?? (reshowable ? onRequestIntro : undefined);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!isClickable}
      className="min-w-0 flex-1 text-left disabled:cursor-default"
    >
      <PromptBody
        title={content.title}
        subTitle={content.subTitle}
        reshowable={reshowable}
        textPx={textPx}
        restoreMs={restoreMs}
      />
    </button>
  );
}

function SubmitAction({ submit }: Readonly<{ submit: NonNullable<BottomHudProps['submit']> }>) {
  return (
    <Button
      onClick={submit.onSubmit}
      disabled={submit.disabled}
      data-submit-button="true"
      className="h-11 shrink-0 px-4 text-xs"
    >
      <span>{submit.label}</span>
      {submit.shortcutHint && !submit.disabled && (
        <kbd className="ml-1.5 hidden rounded border border-white/20 bg-white/10 px-1.5 py-0.5 font-mono text-[10px] leading-none text-white/80 md:inline-flex">
          {submit.shortcutHint}
        </kbd>
      )}
    </Button>
  );
}

export function BottomHud({
  content,
  mode,
  submit,
  selectedCount,
  onRequestIntro,
  onSkip,
  emphasis,
  choices,
  restoreMs = 0,
}: Readonly<BottomHudProps>) {
  const height = bottomBandHeightPx(mode, feedbackStateOf(content));
  const reshowable = !onSkip && content.kind === 'prompt' && onRequestIntro !== undefined;

  function handleBackgroundTap(event: React.MouseEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest('button:not([disabled])')) return;
    if (onSkip) {
      onSkip();
      return;
    }
    if (reshowable) {
      onRequestIntro?.();
    }
  }

  return (
    <footer
      className="shrink-0 bg-[#111111] pb-[env(safe-area-inset-bottom)]"
      onClick={handleBackgroundTap}
    >
      <ChoiceRegion choices={choices} />
      <div
        className="mx-auto flex max-w-2xl items-center justify-center gap-2 px-2"
        style={{ height }}
      >
        <BandBody
          content={content}
          reshowable={reshowable}
          onRequestIntro={onRequestIntro}
          onSkip={onSkip}
          textPx={emphasis?.textPx ?? STEADY_TEXT_PX}
          restoreMs={restoreMs}
        />

        {onSkip && content.kind === 'prompt' && (
          <span className="shrink-0 rounded bg-white/10 px-2 py-1 text-[11px] font-medium text-[#fafafa]/80">
            タップで次へ
          </span>
        )}

        {selectedCount !== undefined && content.kind === 'prompt' && !onSkip && (
          <span className="shrink-0 font-mono text-xs tabular-nums text-[#fafafa]">
            {selectedCount} 件
          </span>
        )}

        {submit && <SubmitAction submit={submit} />}
      </div>
    </footer>
  );
}
