'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { resolveIntroPlan, type IntroPlan } from '@/lib/quiz/hud-metrics';

export type IntroPhase = 'intro' | 'settling' | 'steady';

export interface QuestionIntro {
  readonly phase: IntroPhase;
  readonly plan: IntroPlan;
  /**
   * その問題で導入表示が一度でも終わったか。
   *
   * 下端タップによる再表示では戻さない。戻すと読み返すたびに持ち時間が延び、
   * 事実上の無制限になる。
   */
  readonly settled: boolean;
  readonly requestIntro: () => void;
}

/**
 * お題の導入表示（中央・大 → 下端・小）の進行を持つ。
 *
 * 時間の決め方は `resolveIntroPlan` 側にあり、ここは setTimeout の管理だけを持つ。
 * `reducedMotion` を引数で受けるのは、`matchMedia` を掴むと進行のテストが書けなくなるため。
 */
export function useQuestionIntro(qIdx: number, reducedMotion: boolean): QuestionIntro {
  const plan = resolveIntroPlan(reducedMotion);
  const [phase, setPhase] = useState<IntroPhase>('intro');
  const [settled, setSettled] = useState(false);
  const [introNonce, setIntroNonce] = useState(0);

  const requestIntro = useCallback(() => {
    setIntroNonce((n) => n + 1);
    setPhase('intro');
  }, []);

  // 問題が切り替わったら、導入をやり直してタイマーの許可も外す。
  const prevQIdxRef = useRef(qIdx);
  if (prevQIdxRef.current !== qIdx) {
    prevQIdxRef.current = qIdx;
    setPhase('intro');
    setSettled(false);
    setIntroNonce(0);
  }

  const { holdMs, transitionMs } = plan;

  useEffect(() => {
    if (phase !== 'intro') return;
    const id = setTimeout(() => setPhase('settling'), holdMs);
    return () => clearTimeout(id);
  }, [phase, holdMs, qIdx, introNonce]);

  useEffect(() => {
    if (phase !== 'settling') return;
    const id = setTimeout(() => {
      setPhase('steady');
      setSettled(true);
    }, transitionMs);
    return () => clearTimeout(id);
  }, [phase, transitionMs]);

  return { phase, plan, settled, requestIntro };
}

export interface IntroEmphasis {
  readonly bandPx: number;
  readonly textPx: number;
}

/** 中央のオーバーレイを出すのは、移動する設定でお題を表示している間だけ。 */
export function showsIntroOverlay(intro: QuestionIntro, isPrompt: boolean): boolean {
  return isPrompt && intro.plan.mode === 'motion' && intro.phase !== 'steady';
}

/** 移動しない設定では、中央のオーバーレイの代わりに下端の帯を大きくして補う。 */
export function introEmphasis(
  intro: QuestionIntro,
  isPrompt: boolean,
): IntroEmphasis | undefined {
  const { plan, phase } = intro;
  if (!isPrompt || plan.mode !== 'static' || phase === 'steady') return undefined;
  if (plan.enlargedBandPx === null || plan.enlargedTextPx === null) return undefined;
  return { bandPx: plan.enlargedBandPx, textPx: plan.enlargedTextPx };
}
