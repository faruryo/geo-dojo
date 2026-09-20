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
      enlargedTextPx: null,
    });
  });

  it('prefers-reduced-motion では移動せず、拡大表示を長めに出す', () => {
    expect(resolveIntroPlan(true)).toEqual({
      mode: 'static',
      holdMs: 2500,
      transitionMs: 240,
      enlargedTextPx: 24,
    });
  });

  it('reduced-motion でも中央から下端への移動は持たない', () => {
    // 移動を持たないことは enlargedBandPx / enlargedTextPx を使う分岐であることで表す。
    // transitionMs は移動時間ではなく、拡大した帯を定常へ戻す緩和の長さ。
    expect(resolveIntroPlan(true).mode).toBe('static');
    expect(resolveIntroPlan(true).enlargedTextPx).not.toBeNull();
  });

  it('拡大した帯を戻す緩和は一瞬で終わらせない（かくっと落ちて見える）', () => {
    expect(resolveIntroPlan(true).transitionMs).toBeGreaterThan(0);
    // 長すぎると読み終えたあとも帯が動き続ける。
    expect(resolveIntroPlan(true).transitionMs).toBeLessThanOrEqual(400);
  });

  it('通常時の導入表示は FR-021 の 0.8〜1.2 秒の範囲に収まる', () => {
    const { holdMs } = resolveIntroPlan(false);
    expect(holdMs).toBeGreaterThanOrEqual(800);
    expect(holdMs).toBeLessThanOrEqual(1200);
  });
});

describe('bottomBandHeightPx (029: 0px変動保証)', () => {
  it('県当て（A）は定常・フィードバック中ともに 52px を維持する（0px変動）', () => {
    expect(bottomBandHeightPx('A', 'idle')).toBe(BOTTOM_BAND_MODE_A_PX);
    expect(bottomBandHeightPx('A', 'correct')).toBe(BOTTOM_BAND_MODE_A_PX);
    expect(bottomBandHeightPx('A', 'incorrect')).toBe(BOTTOM_BAND_MODE_A_PX);
  });

  it('BCD は定常・フィードバック中ともに 44px を維持する（0px変動）', () => {
    expect(bottomBandHeightPx('BCD', 'idle')).toBe(BOTTOM_BAND_PX);
    expect(bottomBandHeightPx('BCD', 'correct')).toBe(BOTTOM_BAND_PX);
    expect(bottomBandHeightPx('BCD', 'incorrect')).toBe(BOTTOM_BAND_PX);
  });

  it('解答した瞬間に帯の高さが一切変動しない（SC-003: 0px変動）', () => {
    expect(bottomBandHeightPx('A', 'correct') - bottomBandHeightPx('A', 'idle')).toBe(0);
    expect(bottomBandHeightPx('A', 'incorrect') - bottomBandHeightPx('A', 'idle')).toBe(0);
    expect(bottomBandHeightPx('BCD', 'correct') - bottomBandHeightPx('BCD', 'idle')).toBe(0);
    expect(bottomBandHeightPx('BCD', 'incorrect') - bottomBandHeightPx('BCD', 'idle')).toBe(0);
  });

  it('廃止された定数 BOTTOM_BAND_FEEDBACK_PX は 56 を保持する（後方互換）', () => {
    expect(BOTTOM_BAND_FEEDBACK_PX).toBe(56);
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
