import { describe, it, expect } from 'vitest';
import {
  BOTTOM_BAND_FEEDBACK_PX,
  BOTTOM_BAND_MODE_A_PX,
  BOTTOM_BAND_PX,
  INTRO_TEXT_PX,
  MIN_TEXT_PX,
  STEADY_TEXT_PX,
  TOP_BAND_PX,
  bottomBandHeightPx,
  resolveIntroPlan,
} from '@/lib/quiz/hud-metrics';

describe('resolveIntroPlan', () => {
  it('通常時は中央から下端へ動かすタイムラインを返す', () => {
    expect(resolveIntroPlan(false)).toEqual({
      mode: 'motion',
      holdMs: 1000,
      transitionMs: 320,
      enlargedBandPx: null,
      enlargedTextPx: null,
    });
  });

  it('prefers-reduced-motion では移動せず、拡大表示を長めに出す', () => {
    expect(resolveIntroPlan(true)).toEqual({
      mode: 'static',
      holdMs: 2500,
      transitionMs: 0,
      enlargedBandPx: 64,
      enlargedTextPx: 24,
    });
  });

  it('reduced-motion のとき遷移時間を 0 にする（移動アニメーションを行わない）', () => {
    expect(resolveIntroPlan(true).transitionMs).toBe(0);
  });

  it('通常時の導入表示は FR-021 の 0.8〜1.2 秒の範囲に収まる', () => {
    const { holdMs } = resolveIntroPlan(false);
    expect(holdMs).toBeGreaterThanOrEqual(800);
    expect(holdMs).toBeLessThanOrEqual(1200);
  });
});

describe('bottomBandHeightPx', () => {
  it('県当て（A）の定常状態は確定ボタンを収めるぶん高い', () => {
    expect(bottomBandHeightPx('A', 'idle')).toBe(BOTTOM_BAND_MODE_A_PX);
    expect(BOTTOM_BAND_MODE_A_PX).toBeGreaterThan(BOTTOM_BAND_PX);
  });

  it('A 以外の定常状態は標準の帯の高さになる', () => {
    expect(bottomBandHeightPx('BCD', 'idle')).toBe(BOTTOM_BAND_PX);
  });

  it('フィードバック中はモードによらず同じ高さになる（SC-008）', () => {
    expect(bottomBandHeightPx('A', 'correct')).toBe(BOTTOM_BAND_FEEDBACK_PX);
    expect(bottomBandHeightPx('BCD', 'correct')).toBe(BOTTOM_BAND_FEEDBACK_PX);
    expect(bottomBandHeightPx('A', 'incorrect')).toBe(BOTTOM_BAND_FEEDBACK_PX);
    expect(bottomBandHeightPx('BCD', 'incorrect')).toBe(BOTTOM_BAND_FEEDBACK_PX);
  });

  it('正解と不正解で高さが変わらない（SC-008）', () => {
    expect(bottomBandHeightPx('A', 'correct')).toBe(bottomBandHeightPx('A', 'incorrect'));
    expect(bottomBandHeightPx('BCD', 'correct')).toBe(bottomBandHeightPx('BCD', 'incorrect'));
  });

  it('フィードバック中は定常状態より高い（最長形の折り返しを収めるため）', () => {
    expect(BOTTOM_BAND_FEEDBACK_PX).toBeGreaterThan(BOTTOM_BAND_MODE_A_PX);
  });
});

describe('レイアウト定数', () => {
  it('操作対象を収めるため帯は 44px 以上ある（SC-002）', () => {
    expect(TOP_BAND_PX).toBeGreaterThanOrEqual(44);
    expect(BOTTOM_BAND_PX).toBeGreaterThanOrEqual(44);
  });

  it('定常状態の帯の合計がセーフエリアを除いて 122px 以下に収まる（SC-001）', () => {
    expect(TOP_BAND_PX + BOTTOM_BAND_MODE_A_PX).toBeLessThanOrEqual(122);
  });

  it('導入表示は FR-020 の 32〜36px に収まる', () => {
    expect(INTRO_TEXT_PX).toBeGreaterThanOrEqual(32);
    expect(INTRO_TEXT_PX).toBeLessThanOrEqual(36);
  });

  it('HUD の文字は最小サイズを下回らない（FR-039）', () => {
    expect(MIN_TEXT_PX).toBe(12);
    expect(STEADY_TEXT_PX).toBeGreaterThanOrEqual(MIN_TEXT_PX);
  });
});
