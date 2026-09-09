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
  };
  /** 県当てで選択中の都道府県の件数。個別の取り消しは地図の再タップで行う。 */
  readonly selectedCount?: number;
  /** 帯をタップしたときにお題を中央へ再表示する。 */
  readonly onRequestIntro?: () => void;
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
    <div className="px-3 pb-2">
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
  textPx,
  restoreMs,
}: Readonly<{
  content: BottomHudContent;
  reshowable: boolean;
  onRequestIntro?: () => void;
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

  return (
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
        textPx={textPx}
        restoreMs={restoreMs}
      />
    </button>
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
  restoreMs = 0,
}: Readonly<BottomHudProps>) {
  const height = bottomBandHeightPx(mode, feedbackStateOf(content));
  const reshowable = content.kind === 'prompt' && onRequestIntro !== undefined;

  // 帯のどこを触ってもお題が戻るようにする。選択肢を帯の中に積んだことで、
  // その余白やボタンの隙間という「帯だが再表示ボタンではない」場所ができた。
  // 操作対象（選択肢・確定）の上だけは、それぞれの動作に譲る。
  function handleBackgroundTap(event: React.MouseEvent<HTMLElement>) {
    if (!reshowable) return;
    if ((event.target as HTMLElement).closest('button')) return;
    onRequestIntro?.();
  }

  return (
    // 背景は完全な不透明にする。半透明やすりガラスだと下地の地図の明度を拾い、
    // 明るい Google Maps タイルの上でコントラストを数値で保証できない。
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events -- キーボードと読み上げの経路は中のお題ボタンが持つ。ここは同じ操作を指で広く受けるためだけの補助で、tabIndex を足すと同じ操作に二重の停止点ができる
    <footer
      className="shrink-0 bg-[#111111] pb-[env(safe-area-inset-bottom)]"
      onClick={handleBackgroundTap}
    >
      <ChoiceRegion choices={choices} />
      <div
        className="flex items-center justify-center gap-2 px-2"
        // 高さは内容の長短でも導入表示でも変えない。伸縮すると地図コンテナの高さが
        // 変わり、拡大率と位置がずれるうえ、不正解後の自動フォーカスも安定しない。
        style={{ height }}
      >
        {/* aria-label は付けない。付けると子要素のお題がアクセシブル名から外れ、
            中央の導入表示は aria-hidden なので読み上げでお題を取得できなくなる。
            操作の説明は sr-only のテキストで添える。 */}
        <BandBody
          content={content}
          reshowable={reshowable}
          onRequestIntro={onRequestIntro}
          textPx={emphasis?.textPx ?? STEADY_TEXT_PX}
          restoreMs={restoreMs}
        />

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
