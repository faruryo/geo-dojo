'use client';

import { INTRO_TEXT_PX } from '@/lib/quiz/hud-metrics';
import type { IntroPhase } from './use-question-intro';

interface QuestionIntroProps {
  readonly phase: IntroPhase;
  readonly transitionMs: number;
  readonly title: string;
  readonly subTitle?: string;
}

/**
 * 出題直後に画面中央へ大きく出すお題。3段の骨格の兄弟として絶対配置し、地図コンテナの
 * 中には入れない。中に入れると地図側の transform に引きずられる。
 *
 * 動かすのは transform と opacity だけにする。height や top を動かすとレイアウトが
 * 毎フレーム再計算され、縮小移動がフレーム落ちする。
 *
 * 地色は不透明にする。明るい Google Maps タイルの上では白文字だけでは読めず、
 * 下地の明度に依存しないコントラストを確保できない。
 *
 * 表示中も地図はタップを受け付けてよい。この時点ではまだ計測が始まっていないので、
 * 誤タップによる損失がない。
 */
export function QuestionIntro({
  phase,
  transitionMs,
  title,
  subTitle,
}: Readonly<QuestionIntroProps>) {
  if (phase === 'steady') return null;

  const settling = phase === 'settling';

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-6"
      style={{
        transform: settling ? 'translateY(34vh) scale(0.5)' : 'translateY(0) scale(1)',
        opacity: settling ? 0 : 1,
        transition: `transform ${transitionMs}ms ease-in, opacity ${transitionMs}ms ease-in`,
      }}
    >
      <p className="max-w-full rounded-2xl bg-[#111111] px-5 py-3 text-center font-bold text-[#fafafa]">
        <span className="block leading-tight" style={{ fontSize: INTRO_TEXT_PX }}>
          {title}
        </span>
        {subTitle && (
          <span className="mt-1 block text-base font-normal text-[#fafafa]/80">{subTitle}</span>
        )}
      </p>
    </div>
  );
}
