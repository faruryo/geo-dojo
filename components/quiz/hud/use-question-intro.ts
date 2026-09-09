'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { resolveIntroPlan, type IntroPlan } from '@/lib/quiz/hud-metrics';

export type IntroPhase = 'intro' | 'settling' | 'steady';

/**
 * `useQuestionIntro` に渡す問題キー。
 *
 * 出題していない間も hook は動く。出題外で出題中と同じ値を渡すと、待っている間に
 * 定常へ達したまま出題へ入り、最初の1問だけ導入表示が出ない。
 */
export function questionIntroKey(isPlaying: boolean, questionIndex: number): number {
  return isPlaying ? questionIndex : -1;
}

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
 *
 * `questionKey` は問題を識別する値なら何でもよい。出題していない間も hook は動くので、
 * 出題外では出題中と重ならない値を渡すこと。同じ値のまま出題へ入ると導入をやり直せない。
 */
export function useQuestionIntro(questionKey: number, reducedMotion: boolean): QuestionIntro {
  const plan = resolveIntroPlan(reducedMotion);
  const [phase, setPhase] = useState<IntroPhase>('intro');
  const [settled, setSettled] = useState(false);
  const [introNonce, setIntroNonce] = useState(0);

  // 定常状態からのみ受け付ける。導入中に受け付けると hold を張り直せてしまい、
  // 連打で settled を false のまま保てるため、モード D のカウントダウンを
  // いつまでも始めさせないことができる。
  const requestIntro = useCallback(() => {
    if (phase !== 'steady') return;
    setIntroNonce((n) => n + 1);
    setPhase('intro');
  }, [phase]);

  // 問題が切り替わったら、導入をやり直してタイマーの許可も外す。
  const prevKeyRef = useRef(questionKey);
  if (prevKeyRef.current !== questionKey) {
    prevKeyRef.current = questionKey;
    setPhase('intro');
    setSettled(false);
    setIntroNonce(0);
  }

  const { holdMs, transitionMs } = plan;

  useEffect(() => {
    if (phase !== 'intro') return;
    const id = setTimeout(() => setPhase('settling'), holdMs);
    return () => clearTimeout(id);
  }, [phase, holdMs, questionKey, introNonce]);

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
  readonly textPx: number;
}

/** 中央のオーバーレイを出すのは、移動する設定でお題を表示している間だけ。 */
export function showsIntroOverlay(intro: QuestionIntro, isPrompt: boolean): boolean {
  return isPrompt && intro.plan.mode === 'motion' && intro.phase !== 'steady';
}

/**
 * 移動しない設定では、中央のオーバーレイの代わりに下端のお題の文字を大きくして補う。
 *
 * 大きくするのは `intro` の間だけ。`settling` では既定の寸法へ戻し、その落差を
 * `introRestoreMs` の緩和で埋める。ここで `settling` も大きいままにすると、
 * 相が `steady` へ移る瞬間に緩和ごと外れて一段で切り替わる。
 */
export function introEmphasis(
  intro: QuestionIntro,
  isPrompt: boolean,
): IntroEmphasis | undefined {
  const { plan, phase } = intro;
  if (!isPrompt || plan.mode !== 'static' || phase !== 'intro') return undefined;
  if (plan.enlargedTextPx === null) return undefined;
  return { textPx: plan.enlargedTextPx };
}

/**
 * お題の文字を通常サイズへ戻すときに緩ませる時間。
 *
 * `settling` の間だけ返す。大きくする側まで緩めると、再表示のたびに文字が
 * ぬるっと膨らみ、移動を減らしたい利用者に余計な動きを足すことになる。
 * 大きくするのは即時、戻すときだけ緩やか、が FR-023 の求める形。
 */
export function introRestoreMs(intro: QuestionIntro, isPrompt: boolean): number {
  const { plan, phase } = intro;
  if (!isPrompt || plan.mode !== 'static' || phase !== 'settling') return 0;
  return plan.transitionMs;
}
