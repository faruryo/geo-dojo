'use client';

import { ZoomIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  };
  /** 県当てで選択中の都道府県の件数。個別の取り消しは地図の再タップで行う。 */
  readonly selectedCount?: number;
  /** 帯をタップしたときにお題を中央へ再表示する。 */
  readonly onRequestIntro?: () => void;
}

function feedbackStateOf(content: BottomHudContent): HudFeedbackState {
  if (content.kind !== 'feedback') return 'idle';
  return content.correct ? 'correct' : 'incorrect';
}

function PromptBody({
  title,
  subTitle,
  reshowable,
}: Readonly<{ title: string; subTitle?: string; reshowable: boolean }>) {
  return (
    <p
      className="flex items-baseline justify-center gap-1.5 truncate px-3 text-[#fafafa]"
      style={{ fontSize: STEADY_TEXT_PX }}
    >
      <span className="truncate font-semibold">{title}</span>
      {subTitle && <span className="shrink-0 text-xs text-[#fafafa]/80">{subTitle}</span>}
      {reshowable && <ZoomIn size={14} className="shrink-0 self-center" aria-hidden />}
    </p>
  );
}

export function BottomHud({
  content,
  mode,
  submit,
  selectedCount,
  onRequestIntro,
}: Readonly<BottomHudProps>) {
  const height = bottomBandHeightPx(mode, feedbackStateOf(content));
  const reshowable = content.kind === 'prompt' && onRequestIntro !== undefined;

  return (
    // 背景は完全な不透明にする。半透明やすりガラスだと下地の地図の明度を拾い、
    // 明るい Google Maps タイルの上でコントラストを数値で保証できない。
    <footer className="shrink-0 bg-[#111111] pb-[env(safe-area-inset-bottom)]">
      <div
        className="flex items-center justify-center gap-2 px-2"
        // 高さは内容の長短で変えない。伸縮すると地図コンテナの高さが毎問変わり、
        // 不正解後の自動フォーカスが安定しない。
        style={{ height }}
      >
        <button
          type="button"
          onClick={reshowable ? onRequestIntro : undefined}
          disabled={!reshowable}
          aria-label={reshowable ? 'お題をもう一度大きく表示する' : undefined}
          className="min-w-0 flex-1 text-left disabled:cursor-default"
        >
          {content.kind === 'prompt' && (
            <PromptBody
              title={content.title}
              subTitle={content.subTitle}
              reshowable={reshowable}
            />
          )}
          {content.kind === 'feedback' && (
            <FeedbackLine correct={content.correct} detail={content.detail} />
          )}
        </button>

        {selectedCount !== undefined && content.kind === 'prompt' && (
          <span className="shrink-0 font-mono text-xs tabular-nums text-[#fafafa]">
            {selectedCount} 件
          </span>
        )}

        {submit && (
          <Button
            onClick={submit.onSubmit}
            disabled={submit.disabled}
            className="h-11 shrink-0 px-4 text-xs"
          >
            {submit.label}
          </Button>
        )}
      </div>
    </footer>
  );
}
