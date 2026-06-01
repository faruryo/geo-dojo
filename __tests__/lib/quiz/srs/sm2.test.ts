import { describe, it, expect } from 'vitest';
import { applySm2 } from '@/lib/quiz/srs/sm2';
import type { SrsState } from '@/lib/quiz/srs/types';

const initialState: SrsState = {
  easeFactor: 2.5,
  repetition: 0,
  interval: 0,
  status: 'reviewing',
};

describe('applySm2', () => {
  it('正解(q=4): 1回目は interval=1', () => {
    const result = applySm2(initialState, 4);
    expect(result.repetition).toBe(1);
    expect(result.interval).toBe(1);
    expect(result.dueInDays).toBe(1);
    expect(result.status).toBe('reviewing');
    expect(result.graduated).toBe(false);
  });

  it('正解(q=4): 2回目は interval=6', () => {
    const state1 = applySm2(initialState, 4);
    const state2 = applySm2(state1, 4);
    expect(state2.repetition).toBe(2);
    expect(state2.interval).toBe(6);
  });

  it('正解(q=4): 3回目以降は interval が EF 倍で拡大する', () => {
    let state: SrsState = initialState;
    state = applySm2(state, 4); // rep=1, int=1
    state = applySm2(state, 4); // rep=2, int=6
    const state3 = applySm2(state, 4); // rep=3, int=round(6 * EF)
    expect(state3.repetition).toBe(3);
    expect(state3.interval).toBe(Math.round(6 * state.easeFactor));
    expect(state3.interval).toBeGreaterThan(6);
  });

  it('正解(q=4): easeFactor は変化しない', () => {
    const result = applySm2(initialState, 4);
    expect(result.easeFactor).toBeCloseTo(2.5, 5);
  });

  it('不正解(q=2): repetition=0, interval=1 にリセット', () => {
    // 一度正解してから不正解
    const afterCorrect = applySm2(applySm2(initialState, 4), 4);
    const result = applySm2(afterCorrect, 2);
    expect(result.repetition).toBe(0);
    expect(result.interval).toBe(1);
    expect(result.dueInDays).toBe(1);
    expect(result.status).toBe('reviewing');
    expect(result.graduated).toBe(false);
  });

  it('不正解(q=2): easeFactor が下がる', () => {
    const result = applySm2(initialState, 2);
    expect(result.easeFactor).toBeLessThan(2.5);
  });

  it('easeFactor の下限は 1.3', () => {
    let state: SrsState = { ...initialState, easeFactor: 1.31 };
    state = applySm2(state, 2);
    expect(state.easeFactor).toBeGreaterThanOrEqual(1.3);
    // 更に下げようとしても下限でクランプ
    state = applySm2(state, 2);
    expect(state.easeFactor).toBeGreaterThanOrEqual(1.3);
  });

  it('卒業条件: interval>=30 かつ repetition>=4 で graduated=true', () => {
    // interval=30, rep=4 が成立するように直接状態を設定
    const preGradState: SrsState = {
      easeFactor: 2.5,
      repetition: 3,
      interval: 12, // round(12 * 2.5) = 30
      status: 'reviewing',
    };
    const result = applySm2(preGradState, 4);
    expect(result.interval).toBeGreaterThanOrEqual(30);
    expect(result.repetition).toBe(4);
    expect(result.graduated).toBe(true);
    expect(result.status).toBe('graduated');
  });

  it('不正解では卒業しない（たとえ repetition>=4 でも）', () => {
    const state: SrsState = {
      easeFactor: 2.5,
      repetition: 4,
      interval: 30,
      status: 'reviewing',
    };
    const result = applySm2(state, 2);
    expect(result.graduated).toBe(false);
    expect(result.status).toBe('reviewing');
  });
});
