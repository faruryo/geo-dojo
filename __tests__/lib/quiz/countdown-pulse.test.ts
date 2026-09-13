import { describe, expect, it } from 'vitest';
import {
  getMapPulseType,
  shouldShowMapPulse,
} from '@/lib/quiz/countdown-pulse';

describe('countdown-pulse ドメイン判断', () => {
  describe('shouldShowMapPulse', () => {
    it('出題中（idle）かつ残り6秒以下（1〜6秒）で true を返す', () => {
      expect(shouldShowMapPulse(6, 'idle')).toBe(true);
      expect(shouldShowMapPulse(5, 'idle')).toBe(true);
      expect(shouldShowMapPulse(1, 'idle')).toBe(true);
    });

    it('7秒以上では false を返す', () => {
      expect(shouldShowMapPulse(7, 'idle')).toBe(false);
      expect(shouldShowMapPulse(15, 'idle')).toBe(false);
      expect(shouldShowMapPulse(30, 'idle')).toBe(false);
    });

    it('0秒以下（タイムアウト）では false を返す', () => {
      expect(shouldShowMapPulse(0, 'idle')).toBe(false);
      expect(shouldShowMapPulse(-1, 'idle')).toBe(false);
    });

    it('回答中・フィードバック中（correct / incorrect）では常に false を返す', () => {
      expect(shouldShowMapPulse(5, 'correct')).toBe(false);
      expect(shouldShowMapPulse(5, 'incorrect')).toBe(false);
      expect(shouldShowMapPulse(1, 'correct')).toBe(false);
      expect(shouldShowMapPulse(1, 'incorrect')).toBe(false);
    });
  });

  describe('getMapPulseType', () => {
    it('残り1〜5秒は danger を返す', () => {
      expect(getMapPulseType(1)).toBe('danger');
      expect(getMapPulseType(3)).toBe('danger');
      expect(getMapPulseType(5)).toBe('danger');
    });

    it('残り6秒は warning を返す', () => {
      expect(getMapPulseType(6)).toBe('warning');
    });

    it('7秒以上または0秒以下は null を返す', () => {
      expect(getMapPulseType(7)).toBeNull();
      expect(getMapPulseType(15)).toBeNull();
      expect(getMapPulseType(0)).toBeNull();
      expect(getMapPulseType(-1)).toBeNull();
    });
  });
});
