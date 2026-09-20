import { describe, it, expect } from 'vitest';
import { calculateStreak, resolvePraiseStage } from '@/lib/quiz/streak';

describe('calculateStreak (FR-005d)', () => {
  it('returns 0 for empty results', () => {
    expect(calculateStreak([])).toBe(0);
  });

  it('counts consecutive correct answers from the end of results', () => {
    expect(calculateStreak([{ correct: true }, { correct: true }, { correct: true }])).toBe(3);
    expect(calculateStreak([{ correct: true }, { correct: false }, { correct: true }, { correct: true }])).toBe(2);
    expect(calculateStreak([{ correct: false }])).toBe(0);
    expect(calculateStreak([{ correct: true }, { correct: true }, { correct: false }])).toBe(0);
  });

  it('handles single entry results correctly', () => {
    expect(calculateStreak([{ correct: true }])).toBe(1);
    expect(calculateStreak([{ correct: false }])).toBe(0);
  });
});

describe('resolvePraiseStage (FR-005a/b/c, FR-006a/b)', () => {
  it('handles incorrect (streak 0)', () => {
    const stage = resolvePraiseStage(0);
    expect(stage.label).toBe('不正解');
    expect(stage.showStreakBadge).toBe(false);
    expect(stage.pitchShiftSemitones).toBe(0);
    expect(stage.isFanfare).toBe(false);
    expect(stage.showConfetti).toBe(false);
  });

  it('handles single correct (streak 1)', () => {
    const stage = resolvePraiseStage(1);
    expect(stage.label).toBe('正解！');
    expect(stage.showStreakBadge).toBe(false);
    expect(stage.pitchShiftSemitones).toBe(0);
    expect(stage.isFanfare).toBe(false);
    expect(stage.showConfetti).toBe(false);
  });

  it('handles 2-streak with badge and 1-whole-tone pitch increase', () => {
    const stage = resolvePraiseStage(2);
    expect(stage.label).toBe('いいね！');
    expect(stage.showStreakBadge).toBe(true);
    expect(stage.pitchShiftSemitones).toBe(2);
    expect(stage.isFanfare).toBe(false);
    expect(stage.showConfetti).toBe(false);
  });

  it('handles 3-streak and 4-streak stepping up labels and pitch', () => {
    const s3 = resolvePraiseStage(3);
    expect(s3.label).toBe('お見事！');
    expect(s3.showStreakBadge).toBe(true);
    expect(s3.pitchShiftSemitones).toBe(4);

    const s4 = resolvePraiseStage(4);
    expect(s4.label).toBe('すごい！');
    expect(s4.showStreakBadge).toBe(true);
    expect(s4.pitchShiftSemitones).toBe(6);
    expect(s4.isFanfare).toBe(false);
    expect(s4.showConfetti).toBe(false);
  });

  it('triggers confetti and fanfare ONLY on streak === 5 (FR-006b, FR-005c)', () => {
    const s5 = resolvePraiseStage(5);
    expect(s5.label).toBe('完璧！');
    expect(s5.showStreakBadge).toBe(true);
    expect(s5.pitchShiftSemitones).toBe(6);
    expect(s5.isFanfare).toBe(true);
    expect(s5.showConfetti).toBe(true);
  });

  it('maintains perfect label and badge for streak >= 6, but disables confetti and fanfare (FR-006b)', () => {
    for (const streak of [6, 7, 10, 20]) {
      const stage = resolvePraiseStage(streak);
      expect(stage.label).toBe('完璧！');
      expect(stage.showStreakBadge).toBe(true);
      expect(stage.pitchShiftSemitones).toBe(6);
      expect(stage.isFanfare).toBe(false);
      expect(stage.showConfetti).toBe(false);
    }
  });
});
