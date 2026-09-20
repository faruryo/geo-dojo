import { describe, expect, it } from 'vitest';
import {
  getChordTones,
  FANFARE_TOTAL_DURATION_SEC,
  CHORD_TOTAL_DURATION_SEC,
} from '@/lib/quiz/sound-effects';

describe('Sound Effects: 和音 SE 合成パラメータ & ピッチシフト (US3)', () => {
  it('再生時間は 0.35 秒以内を厳守する (FR-005a, FR-005c)', () => {
    // Streak 1〜4, 6+
    for (const streak of [1, 2, 3, 4, 6, 10]) {
      const tones = getChordTones(streak);
      const totalDuration = Math.max(...tones.map((t) => t.startAt + t.duration));
      expect(totalDuration).toBeLessThanOrEqual(0.35);
      expect(totalDuration).toBeCloseTo(CHORD_TOTAL_DURATION_SEC, 2);
    }

    // Streak 5 (ファンファーレ)
    const fanfareTones = getChordTones(5);
    const fanfareDuration = Math.max(...fanfareTones.map((t) => t.startAt + t.duration));
    expect(fanfareDuration).toBeLessThanOrEqual(0.35);
    expect(fanfareDuration).toBeCloseTo(FANFARE_TOTAL_DURATION_SEC, 2);
  });

  it('Streak 1〜4 で全音ずつピッチが上昇する (FR-005b)', () => {
    const tones1 = getChordTones(1);
    const tones2 = getChordTones(2);
    const tones3 = getChordTones(3);
    const tones4 = getChordTones(4);

    // 根音の周波数が全音（2半音 = 2^(2/12) ≈ 1.12246）ずつ上がる
    const root1 = tones1[0].frequency;
    const root2 = tones2[0].frequency;
    const root3 = tones3[0].frequency;
    const root4 = tones4[0].frequency;

    // C6 ≈ 1046.50 Hz
    expect(root1).toBeCloseTo(1046.5, 1);
    // D6 ≈ 1174.66 Hz
    expect(root2).toBeCloseTo(root1 * Math.pow(2, 2 / 12), 1);
    // E6 ≈ 1318.51 Hz
    expect(root3).toBeCloseTo(root1 * Math.pow(2, 4 / 12), 1);
    // F#6 ≈ 1479.98 Hz
    expect(root4).toBeCloseTo(root1 * Math.pow(2, 6 / 12), 1);
  });

  it('Streak 6 以降は 4 段階目の最高音程を維持する (FR-005c)', () => {
    const tones4 = getChordTones(4);
    const tones6 = getChordTones(6);
    const tones10 = getChordTones(10);

    expect(tones6[0].frequency).toBeCloseTo(tones4[0].frequency, 1);
    expect(tones10[0].frequency).toBeCloseTo(tones4[0].frequency, 1);
  });

  it('Streak 5 はファンファーレ和音構成（高速アルペジオ＋オクターブ上展開）になる (FR-005c)', () => {
    const tones = getChordTones(5);
    // C6 (t=0.00), E6 (t=0.06), G6 (t=0.12), C7+G6 (t=0.18) の計5ノード
    expect(tones.length).toBeGreaterThanOrEqual(4);

    const freqs = tones.map((t) => t.frequency);
    // C7 (約 2093 Hz) が含まれている
    const hasC7 = freqs.some((f) => Math.abs(f - 2093.0) < 5);
    expect(hasC7).toBe(true);

    // 最大再生時間は 0.34s
    const totalDuration = Math.max(...tones.map((t) => t.startAt + t.duration));
    expect(totalDuration).toBeCloseTo(0.34, 2);
  });
});
