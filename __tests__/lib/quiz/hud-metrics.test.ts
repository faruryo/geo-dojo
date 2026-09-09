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

  it('フィードバック中は定常状態より低くならない（解答した瞬間に帯が縮まない）', () => {
    expect(BOTTOM_BAND_FEEDBACK_PX).toBeGreaterThanOrEqual(BOTTOM_BAND_MODE_A_PX);
    expect(BOTTOM_BAND_FEEDBACK_PX).toBeGreaterThanOrEqual(BOTTOM_BAND_PX);
  });

  it('実測で確定した高さから動かさない', () => {
    // 375px の実測に基づく値。最長形（62文字）は2行 30px、行の高さは 15px。
    // 下の関係だけでは暫定値だった 72px も通ってしまい、実測へ詰めた変更を守れない。
    // 動かすときは測り直し、この期待値も一緒に更新する。
    expect(BOTTOM_BAND_FEEDBACK_PX).toBe(56);
  });

  it('最長形が3行になっても割れない高さがある', () => {
    const LINE_HEIGHT_PX = 15;
    expect(BOTTOM_BAND_FEEDBACK_PX).toBeGreaterThanOrEqual(LINE_HEIGHT_PX * 3);
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
