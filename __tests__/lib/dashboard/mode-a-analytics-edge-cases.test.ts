import { describe, expect, it } from 'vitest';
import { representativeDifficulty, type Municipality } from '@/lib/quiz/municipality-data';
import {
  getModeAClearedCityNames,
  type ModeAHistoryRow,
} from '@/lib/db/queries/dashboard';

describe('Mode A Analytics Edge Cases & Regressions', () => {
  describe('Mode A Representative Difficulty', () => {
    it('異なる地方にまたがる同名市（例: 伊達市 = 北海道/福島）で、最難関難易度が選ばれること', () => {
      const instances: Municipality[] = [
        { code: '01233', name: '伊達市', prefecture: '北海道', region: '北海道', difficulty: 'easy' },
        { code: '07213', name: '伊達市', prefecture: '福島県', region: '東北', difficulty: 'hard' },
      ];

      const rep = representativeDifficulty(instances);
      expect(rep).toBe('hard');
    });
  });

  describe('getModeAClearedCityNames (2000ms sequential grouping)', () => {
    it('偶数秒境界を跨ぐ2秒未満の回答（1001.9s と 1002.1s）が同一質問として集約され、片方不正解ならクリアにならないこと', () => {
      // 差は 200ms。固定幅バケット floor(epoch/2) だと 500 と 501 で分かれてしまう境界
      const rows: ModeAHistoryRow[] = [
        {
          municipalityName: '伊達市',
          answeredAt: new Date('2026-09-01T12:00:01.900Z'),
          isCorrect: true, // 北海道側正解
        },
        {
          municipalityName: '伊達市',
          answeredAt: new Date('2026-09-01T12:00:02.100Z'),
          isCorrect: false, // 福島側不正解
        },
      ];

      const cleared = getModeAClearedCityNames(rows);
      expect(cleared.has('伊達市')).toBe(false);
    });

    it('偶数秒境界を跨ぐ2秒未満の回答（1001.9s と 1002.1s）で両県正解ならクリア扱いになること', () => {
      const rows: ModeAHistoryRow[] = [
        {
          municipalityName: '伊達市',
          answeredAt: new Date('2026-09-01T12:00:01.900Z'),
          isCorrect: true,
        },
        {
          municipalityName: '伊達市',
          answeredAt: new Date('2026-09-01T12:00:02.100Z'),
          isCorrect: true,
        },
      ];

      const cleared = getModeAClearedCityNames(rows);
      expect(cleared.has('伊達市')).toBe(true);
    });

    it('2000ms 超離れた別セッションでは独立して評価されること', () => {
      const rows: ModeAHistoryRow[] = [
        // 1回目の出題: 不正解
        {
          municipalityName: '伊達市',
          answeredAt: new Date('2026-09-01T12:00:00.000Z'),
          isCorrect: false,
        },
        {
          municipalityName: '伊達市',
          answeredAt: new Date('2026-09-01T12:00:00.500Z'),
          isCorrect: false,
        },
        // 2回目の出題（5秒後）: 全問正解
        {
          municipalityName: '伊達市',
          answeredAt: new Date('2026-09-01T12:00:05.500Z'),
          isCorrect: true,
        },
        {
          municipalityName: '伊達市',
          answeredAt: new Date('2026-09-01T12:00:05.800Z'),
          isCorrect: true,
        },
      ];

      const cleared = getModeAClearedCityNames(rows);
      expect(cleared.has('伊達市')).toBe(true);
    });

    it('市名が交錯（伊達市1.9s -> 府中市2.0s -> 伊達市2.1s）しても市名ごとに正しく集約され、片方不正解ならクリアにならないこと', () => {
      const rows: ModeAHistoryRow[] = [
        {
          municipalityName: '伊達市',
          answeredAt: new Date('2026-09-01T12:00:01.900Z'),
          isCorrect: true, // 伊達市北海道=正解
        },
        {
          municipalityName: '府中市',
          answeredAt: new Date('2026-09-01T12:00:02.000Z'),
          isCorrect: true, // 府中市東京=正解
        },
        {
          municipalityName: '伊達市',
          answeredAt: new Date('2026-09-01T12:00:02.100Z'),
          isCorrect: false, // 伊達市福島=不正解
        },
      ];

      const expectedCounts = new Map([
        ['伊達市', 2],
        ['府中市', 2],
      ]);

      const cleared = getModeAClearedCityNames(rows, expectedCounts);
      // 伊達市は片方不正解なのでクリア不可
      expect(cleared.has('伊達市')).toBe(false);
      // 府中市は1件しかなく2件揃っていないのでクリア不可
      expect(cleared.has('府中市')).toBe(false);
    });

    it('旧保存経路などで一部インスタンスのみ保存された欠損データ（2件中1件のみ）ではクリアにならないこと', () => {
      const rows: ModeAHistoryRow[] = [
        {
          municipalityName: '伊達市',
          answeredAt: new Date('2026-09-01T12:00:01.000Z'),
          isCorrect: true, // 1件だけ正解で保存された
        },
      ];

      const expectedCounts = new Map([['伊達市', 2]]);
      const cleared = getModeAClearedCityNames(rows, expectedCounts);
      expect(cleared.has('伊達市')).toBe(false);
    });

    it('空配列の場合は空の Set を返すこと', () => {
      const cleared = getModeAClearedCityNames([]);
      expect(cleared.size).toBe(0);
    });
  });
});
