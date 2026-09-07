'use client';

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
  };
  /** 県当てで選択中の都道府県の件数。個別の取り消しは地図の再タップで行う。 */
  readonly selectedCount?: number;
  /** 帯をタップしたときにお題を中央へ再表示する。 */
  readonly onRequestIntro?: () => void;
  /**
   * 移動アニメーションを行わない設定のとき、導入の代わりに帯ごと大きく見せる。
   * 中央のオーバーレイを出さない分をここで補う。
   */
  readonly emphasis?: { readonly bandPx: number; readonly textPx: number };
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
}: Readonly<{ title: string; subTitle?: string; reshowable: boolean; textPx: number }>) {
  return (
    <span
      className="flex items-baseline justify-center gap-1.5 truncate px-3 text-[#fafafa]"
      style={{ fontSize: textPx }}
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
    <div className="px-3 pb-2">
      <ChoiceView
        choices={choices.items}
        selectedChoice={choices.selected}
        correctChoice={choices.correct}
        feedback={choices.feedback}
        onSelectChoice={choices.onSelect}
      />
    </div>
  );
}

export function BottomHud({
  content,
  mode,
  submit,
  selectedCount,
  onRequestIntro,
  emphasis,
  choices,
}: Readonly<BottomHudProps>) {
  const height = emphasis?.bandPx ?? bottomBandHeightPx(mode, feedbackStateOf(content));
  const reshowable = content.kind === 'prompt' && onRequestIntro !== undefined;

  return (
    // 背景は完全な不透明にする。半透明やすりガラスだと下地の地図の明度を拾い、
    // 明るい Google Maps タイルの上でコントラストを数値で保証できない。
    <footer className="shrink-0 bg-[#111111] pb-[env(safe-area-inset-bottom)]">
      <ChoiceRegion choices={choices} />
      <div
        className="flex items-center justify-center gap-2 px-2"
        // 高さは内容の長短で変えない。伸縮すると地図コンテナの高さが毎問変わり、
        // 不正解後の自動フォーカスが安定しない。
        style={{ height }}
      >
        {/* aria-label は付けない。付けると子要素のお題がアクセシブル名から外れ、
            中央の導入表示は aria-hidden なので読み上げでお題を取得できなくなる。
            操作の説明は sr-only のテキストで添える。 */}
        {content.kind === 'prompt' ? (
          <button
            type="button"
            onClick={onRequestIntro}
            disabled={!reshowable}
            className="min-w-0 flex-1 text-left disabled:cursor-default"
          >
            <PromptBody
              title={content.title}
              subTitle={content.subTitle}
              reshowable={reshowable}
              textPx={emphasis?.textPx ?? STEADY_TEXT_PX}
            />
          </button>
        ) : (
          // フィードバックは操作対象ではない。button に入れると無効な操作要素として
          // 読み飛ばされうるうえ、p を button の中に置けない。
          <div className="min-w-0 flex-1">
            <FeedbackLine correct={content.correct} detail={content.detail} />
          </div>
        )}

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
